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
    disableConcurrentBuilds()
  }
  triggers {
    pollSCM('H/15 * * * *')
  }
  stages {
    stage('checkout') {
      steps {
        git branch: "${env.GIT_BRANCH}", url: "${env.GIT_URL}"
      }
    }
    stage('setup') {
      steps {
        sh '''
          apt update
          apt install -y npm git
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
    stage('cleanup') {
      when {
        allOf {
          changelog '.*Merge branch.*'
          not {
            branch 'master'
          }
        }
      }
      steps {
        sh '''
          old_branch=$(git log -1 --format=oneline | sed -E "s/.*Merge branch '[^']*'.*/\\1/")
          aws cloudformation delete-stack --stack-name "${PROJECT}-${old_branch}"
        '''
      }
    }
    stage('test') {
      when { not { changelog '.*Merge branch.*' } }
      steps {
        sh '''
          sam validate
        '''
      }
    }
    stage('build') {
      when { not { changelog '.*Merge branch.*' } }
      steps {
        sh '''
          sam build
          sam package --s3-bucket "$CI_BUCKET" \
                      --s3-prefix "$(cat .meta/jenkins/PROJECT)"
        '''
      }
    }
    stage('deploy') {
      when { not { changelog '.*Merge branch.*' } }
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
    success {
        sh '''
          pip3 install awscli --upgrade
          mkdir -p build/output
          aws s3 sync "s3://${CI_BUCKET}/$(cat .meta/jenkins/PROJECT)" build/output
        '''
        archiveArtifacts artifacts: 'build/output/**', fingerprint: true
    }
    cleanup {
        deleteDir() /* clean up our workspace */
    }
  }
}
