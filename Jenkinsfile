pipeline {
    agent { label 'ca-brightside-ce-agent' }
    environment {
        // Endevor Details
        ENDEVOR_CONNECTION="--port 6002 --protocol http --reject-unauthorized false"
        ENDEVOR_LOCATION="--instance ENDEVOR --env DEV --sys MARBLES --sub MARBLES --stage-number 1 --ccid JENKXX --comment JENKXX"
        ENDEVOR="$ENDEVOR_CONNECTION $ENDEVOR_LOCATION"

        ZOWE_OPT_HOSTNAME=credentials('eosHost')

        // z/OSMF Connection Details
        ZOWE_OPT_HOST=credentials('eosHost')
        ZOWE_OPT_PORT="443"
        ZOWE_OPT_REJECT_UNAUTHORIZED=false

        // File Master Plus Connection Details
	    FMP="--port 6001 --protocol http --reject-unauthorized false"

        // CICS Connection Details
	    CICS="--port 6000 --region-name CICSTRN1"
    }
    stages {
        stage('build') {
            steps {
                sh 'node --version'
                sh 'npm --version'
                sh 'bright --version'
                sh 'bright plugins list'
                sh 'npm install gulp-cli -g'
                sh 'npm install'
                //ZOWE_OPT_USERNAME & ZOWE_OPT_PASSWORD are used to interact with Endevor 
                withCredentials([usernamePassword(credentialsId: 'eosCreds', usernameVariable: 'ZOWE_OPT_USERNAME', passwordVariable: 'ZOWE_OPT_PASSWORD')]) {
                    sh 'gulp build'
                }
            }
        }
        stage('deploy') {
            steps {
                //ZOWE_OPT_USER & ZOWE_OPT_PASS are used to interact with z/OSMF and FMP
                withCredentials([usernamePassword(credentialsId: 'eosCreds', usernameVariable: 'ZOWE_OPT_USER', passwordVariable: 'ZOWE_OPT_PASSWORD')]) {
                        sh 'gulp deploy'
                    }
                }
            }
        }
        stage('test') {
            steps {
                //ZOWE_OPT_USER & ZOWE_OPT_PASS are used to interact with z/OSMF
                withCredentials([usernamePassword(credentialsId: 'eosCreds', usernameVariable: 'ZOWE_OPT_USER', passwordVariable: 'ZOWE_OPT_PASSWORD')]) {
                    sh 'npm test'
                }
            }
        }
    }
}