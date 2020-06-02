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
    stage('test') {
      steps {
        sh '''
          apt update
          apt install -y npm
          pip3 install awscli
          pip3 install aws-sam-cli
          sam validate
        '''
      }
    }
    stage('build') {
      steps {
        sh '''
          apt update
          apt install -y npm
          pip3 install awscli
          pip3 install aws-sam-cli
          sam build
          prefix="${PROJECT}-${GIT_LOCAL_BRANCH}"
          sam package --s3-bucket "$CI_BUCKET" \
                      --s3-prefix "$prefix"
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
          apt update
          apt install -y npm
          pip3 install awscli
          pip3 install aws-sam-cli
          prefix="${PROJECT}-${GIT_LOCAL_BRANCH}"
          sam deploy --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
                     --no-confirm-changeset \
                     --no-fail-on-empty-changeset \
                     --s3-prefix "$prefix" \
                     --s3-bucket "$CI_BUCKET" \
                     --stack-name "${PROJECT}-${GIT_LOCAL_BRANCH}"
        '''
      }
    }
  }
  post {
    always {
        sh '''
          pip3 install awscli --upgrade
          mkdir -p build/output
          aws s3 sync "s3://${CI_BUCKET}/${PROJECT}-${GIT_LOCAL_BRANCH}" build/output
        '''
        archiveArtifacts artifacts: 'build/output/**', fingerprint: true
        deleteDir() /* clean up our workspace */
    }
  }
}
