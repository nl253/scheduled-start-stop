const { EC2, SSM } = require('aws-sdk');
const ec2 = new EC2();
const ssm = new SSM();

/**
 * @return {Promise<{HOUR_START: number, HOUR_END: number, INSTANCE_ID: string[], REGION: string}>}
 */
const getParams = async () => {
  const last = array => array[array.length - 1];
  const params = (await ssm.getParametersByPath({
    Path: process.env.PARAMS_PATH,
    WithDecryption: true,
  }).promise()).Parameters;
  const o = Object.fromEntries(params.map(({Name, Value}) => [last(Name.split('/')), Value]));
  o.INSTANCE_ID = o.INSTANCE_ID.split(',');
  o.HOUR_START = parseInt(o.HOUR_START);
  o.HOUR_END = parseInt(o.HOUR_END);
  return o;
};

exports.handler = async (_event, _context) => {
  const { HOUR_END, INSTANCE_ID, HOUR_START } = await getParams();

  const d = new Date();
  const h = d.getUTCHours() + 1;

  console.log(`it's ${d}, hour is ${h}, start hour is ${HOUR_START}, end hour is ${HOUR_END}`);

  try {
    let body = 'nothing happened';
    if (h === HOUR_START) {
      body = JSON.stringify(await ec2.startInstances({InstanceIds: INSTANCE_ID}).promise());
    } else if (h === HOUR_END) {
      body = JSON.stringify(await ec2.stopInstances({InstanceIds: INSTANCE_ID}).promise());
    }
    console.log(body);
    return { body, statusCode: 200 };
  } catch (e) {
    e = JSON.stringify(e);
    console.error(e);
    return { body: e, statusCode: 500 };
  }
};

