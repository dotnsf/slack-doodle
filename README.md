# Slack Doodle

## Overview

Sample Application for Skack API, which can upload your doodle in your Slack channel.


## Pre-requisite

- Slack account

- Slack App

    - Login to https://api.slack.com/apps

      - Your app would be enabled only for this user's Slack workspaces:

    - Create app

    - Get client_id & client_secret, and edit them in settings.js

    - Set proper redirect URL

        - http(s)://xxx.xxxx.xxx/slack/callback

    - Add following minimum scopes:

        - channels:read

        - chat:write:user

        - files:write:user

- Public application server for Node.js

    - I would describe followings as you use IBM Cloud for this environment.


## Pre-requisite for IBM Cloud user

- Node.js runtime


## Install

- Download source from github.com

    - https://github.com/dotnsf/slack-doodle.git

- Edit settings.js with following information:

    - exports.slack_client_id : client_id for Slack App

    - exports.slack_client_secret : client_secret for Slack App

- Deploy application into IBM Cloud



## Links

- Slack API

    - https://api.slack.com/


## Copyright

2019 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
