const { EC2 } = require('aws-sdk');
const ec2 = new EC2();
const TAG_NAME = 'scheduled-start-stop';


/**
 * @return {Promise<{tags: Record<string, string>, id: string, state: ("pending"|"running"|"shutting-down"|"terminated"|"stopping"|"stopped")}[]>}
 */
const getInstances = async () => {
  const vms = await ec2.describeInstances({ Filters: [{Name: 'tag-key', Values: [TAG_NAME]}] }).promise();
  return vms.Reservations
            .flatMap((({Instances}) => Instances))
            .flatMap(vms => vms)
            .map(({ InstanceId, State, Tags }) => ({
    state: State.Name,
    id: InstanceId,
    tags: Object.fromEntries(Tags.map(({ Key, Value }) => [Key, Value])),
  }));
};

exports.handler = async (_event, _context) => {
  const d = new Date();
  const h = d.getUTCHours() + 1;

  console.log(`it's ${d}, hour is ${h}`);

  const res = {
    start: { instances: [], info: undefined },
    stop: { instances: [], info: undefined },
    ignore: { instances: [] },
  };

  try {
    const instances = await getInstances();
    console.info(`collected instances: ${JSON.stringify(instances)}`);
    for (const {id, tags, state} of instances) {
      const name = tags.Name ? `${tags.Name} ${id}` : id;
      const [timeStart, timeEnd] = tags[TAG_NAME].split(/-+/g)
                                                 .map(s => s.trim())
                                                 .filter(Boolean)
                                                 .map(s => parseInt(s));
      console.info(`time bounds for ${name} are ${timeStart} to ${timeEnd}`);
      if (h >= timeStart && h <= timeEnd) {
        if (state === 'stopped') {
          console.info(`scheduling ${name} for start`);
          res.start.instances.push(id);
        } else {
          console.info(`nothing to be done for ${name}`);
          res.ignore.instances.push(id);
        }
      } else {
        if (state === 'stopped') {
          console.info(`nothing to be done for ${name}`);
          res.ignore.instances.push(id);
        } else {
          console.info(`scheduling ${name} for stop`);
          res.stop.instances.push(id);
        }
      }
    }

    await Promise.all([
      (async () => {
        if (res.start.instances.length > 0) {
          res.start.info = await ec2.startInstances({InstanceIds: res.start.instances}).promise();
        }
      })(),
      (async () => {
        if (res.stop.instances.length > 0) {
          res.stop.info = await ec2.stopInstances({InstanceIds: res.stop.instances}).promise();
        }
      })(),
    ]);

    return { body: JSON.stringify(res), statusCode: 200 };

  } catch (e) {
    e = JSON.stringify(e);
    console.error(e);
    return { body: e, statusCode: 500 };
  }
};

