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
    NODE_VERSION          = '12'
    NVM_VERSION           = '0.35.3'
  }
  options {
    timeout(time: 20, unit: 'MINUTES')
    timestamps()
    disableConcurrentBuilds()
  }
  triggers {
    pollSCM('H/5 * * * *')
  }
  parameters {
    string(name: 'CLEANUP_BRANCH', defaultValue: '', description: 'Branch which should be cleaned up.')
  }
  stages {
    stage('setup') {
      steps {
        sh '''
          mkdir -p artifacts/{deploy,test,package}

          # Node.js
          curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          nvm install "$NODE_VERSION"
          nvm use "$NODE_VERSION"

          # AWS
          pip3 install awscli
          pip3 install aws-sam-cli
        '''
      }
    }
    stage('cleanup') {
      when {
        expression {
          params.CLEANUP_BRANCH.size() > 0
        }
      }
      steps {
        sh '''
          suffix="${PROJECT}-${CLEANUP_BRANCH}"
          aws cloudformation delete-stack --stack-name "$suffix"
          aws s3 rm --recursive "s3://${CI_BUCKET}/${suffix}"
        '''
      }
    }
    stage('test') {
      when {
        expression {
          params.CLEANUP_BRANCH.size() == 0
        }
      }
      steps {
        sh '''
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          sam validate > artifacts/test/results.txt
        '''
      }
    }
    stage('build') {
      when {
        expression {
          params.CLEANUP_BRANCH.size() == 0
        }
      }
      steps {
        sh '''
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          sam build
        '''
      }
    }
    stage('package-master') {
      when {
        allOf {
          expression {
            params.CLEANUP_BRANCH.size() == 0
          }
          branch 'master'
        }
      }
      steps {
        sh '''
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          sam package --s3-bucket "$CI_BUCKET" \
                      --s3-prefix "$PROJECT"
        '''
      }
    }
    stage('package') {
      when {
        allOf {
          expression {
            params.CLEANUP_BRANCH.size() == 0
          }
          not {
            branch 'master'
          }
        }
      }
      steps {
        sh '''
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          sam package --s3-bucket "$CI_BUCKET" \
                      --s3-prefix "${PROJECT}-${BRANCH_NAME}"
        '''
      }
    }
    stage('deploy-master') {
      when {
        allOf {
          expression {
            params.CLEANUP_BRANCH.size() == 0
          }
          branch 'master'
        }
      }
      steps {
        sh '''
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          sam deploy --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
                     --no-confirm-changeset \
                     --no-fail-on-empty-changeset \
                     --s3-prefix "$PROJECT" \
                     --s3-bucket "$CI_BUCKET" \
                     --stack-name "$PROJECT"
        '''
      }
    }
    stage('deploy') {
      when {
        allOf {
          expression {
            params.CLEANUP_BRANCH.size() == 0
          }
          not {
            branch 'master'
          }
        }
      }
      steps {
        sh '''
          export NVM_DIR="$HOME/.nvm"
          . "$NVM_DIR/nvm.sh"
          sam deploy --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
                     --no-confirm-changeset \
                     --no-fail-on-empty-changeset \
                     --s3-prefix "${PROJECT}-${BRANCH_NAME}" \
                     --s3-bucket "$CI_BUCKET" \
                     --stack-name "${PROJECT}-${BRANCH_NAME}"
        '''
      }
    }
  }
  post {
    success {
        sh '''
          apt update
          apt install -y zip
          zip -r artifacts.zip .
          aws s3 cp --storage-class STANDARD_IA --content-encoding deflate "artifacts.zip" "s3://${CI_BUCKET}/${PROJECT}/${BRANCH_NAME}/${GIT_COMMIT}.zip"
        '''
        archiveArtifacts artifacts: 'artifacts/**', fingerprint: true, onlyIfSuccessful: true, excludes: 'artifacts/build/*/node_modules/**'
    }
    cleanup {
        deleteDir() /* clean up our workspace */
    }
  }
}
