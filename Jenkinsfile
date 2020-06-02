pipeline {
  agent {
    docker {
      image 'python:3.8'
      args '--user root'
    }
  }
  environment {
    AWS_ACCESS_KEY_ID     = credentials('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = credentials('AWS_SECRET_ACCESS_KEY')
    AWS_DEFAULT_REGION    = 'eu-west-2'
    CI_BUCKET             = 'codebuild-nl'
    PROJECT               = 'scheduled-start-stop'
  }
  options {
    timeout(time: 5, unit: 'MINUTES')
    timestamps()
  }
  triggers {
    pollSCM('H/15 * * * *')
  }
  stages {
    stage('setup') {
      steps {
        sh '''
          apt update
          apt install -y npm
          pip3 install awscli
          pip3 install aws-sam-cli
          mkdir -p .meta/jenkins
          if [[ $GIT_LOCAL_BRANCH == master ]]; then
            echo "$PROJECT" > .meta/jenkins/PROJECT
          else
            echo "$PROJECT-${GIT_LOCAL_BRANCH}" > .meta/jenkins/PROJECT
          fi
        '''
      }
    }
  }
  stages {
    stage('test') {
      steps {
        sh '''
          sam validate
        '''
      }
    }
    stage('build') {
      steps {
        sh '''
          sam build
          sam package --s3-bucket "$CI_BUCKET" \
                      --s3-prefix "$(cat .meta/jenkins/PROJECT)"
        '''
      }
    }
    stage('deploy') {
      environment {
        AWS_ACCESS_KEY_ID     = credentials('AWS_ACCESS_KEY_ID')
        AWS_SECRET_ACCESS_KEY = credentials('AWS_SECRET_ACCESS_KEY')
        AWS_DEFAULT_REGION    = 'eu-west-2'
      }
      steps {
        sh '''
          sam deploy --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
                     --no-confirm-changeset \
                     --no-fail-on-empty-changeset \
                     --s3-prefix "$(cat .meta/jenkins/PROJECT)" \
                     --s3-bucket "$CI_BUCKET" \
                     --stack-name "$(cat .meta/jenkins/PROJECT)"
        '''
      }
    }
  }
  post {
    always {
        sh '''
          pip3 install awscli --upgrade
          mkdir -p build/output
          aws s3 sync "s3://${CI_BUCKET}/$(cat .meta/jenkins/PROJECT)" build/output
        '''
        archiveArtifacts artifacts: 'build/output/**', fingerprint: true
        deleteDir() /* clean up our workspace */
    }
  }
}
