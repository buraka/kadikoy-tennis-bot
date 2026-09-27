#!/usr/bin/env bash
# Writes ios/Secrets.xcconfig from the deployed stack (endpoints) and SSM (app secret). Gitignored.
set -euo pipefail
# Stack lives in the gps-tracker account (569378724208), deployed with the tennis-deploy user
export AWS_PROFILE="${AWS_PROFILE:-tennis}"
cd "$(dirname "$0")/.."
REGION=eu-central-1
STACK=serverless-tennis-bot-dev
out() { aws cloudformation describe-stacks --region $REGION --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
SLOTS=$(out SlotsUrl)
REGISTER=$(out RegisterDeviceLambdaFunctionUrl)
SECRET=$(aws ssm get-parameter --region $REGION --name /tennis/APP_SHARED_SECRET --with-decryption --query Parameter.Value --output text)
# "//" starts a comment in xcconfig
esc() { echo "$1" | sed 's#://#:/$()/#'; }
cat > ios/Secrets.xcconfig <<CFG
SLOTS_URL = $(esc "$SLOTS")
REGISTER_URL = $(esc "$REGISTER")
APP_SECRET = $SECRET
CFG
chmod 600 ios/Secrets.xcconfig
echo "ios/Secrets.xcconfig yazildi"
