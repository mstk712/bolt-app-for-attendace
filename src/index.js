const { App, ReceiverMultipleAckError } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const { memory } = require('console');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';

let auth;

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), {});
});

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    //callback(oAuth2Client);
    auth = oAuth2Client;
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      //callback(oAuth2Client);
      auth = oAuth2Client;
    });
  });
}

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
});

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

app.message('hello', async ({ message, say }) => {
    //await say(`Hey there ${message.user}`);
    await say(`Accepted ${message.user}`);
    console.log(message);
    const moment = require('moment');
    const ts = moment.unix(Math.floor(message.ts)).format("YYYY-MM-DD HH:mm:ssZ");
    console.log(ts);
    //let real_name;

    //(async () => {
        const response = await web.users.info({user: message.user});
        console.log(response);
        //await say(`Your email is ${response.user.profile.email}`);
        const real_name = await response.user.profile.real_name;
    //})();

    {
        const to_address = process.env.MAIL_TO_ADDRESS;
        const from_address = process.env.MAIL_FROM_ADDRESS;
        const gmail = google.gmail({ version: 'v1', auth });
        const _subject = `勤務開始 ${ts} ${real_name}`;
        const subject = new Buffer.from(_subject).toString('base64');
        const _messageBody = `${ts}`;
        const _mailBody = [
          `Content-Type: text/plain; charset=\"UTF-8\"\n`,
          `MIME-Version: 1.0\n`,
          `Content-Transfer-Encoding: 7bit\n`,
          `to: ${to_address} \n`,
          `from: ${from_address} \n`,
          `subject: =?UTF-8?B?${subject}?= \n\n`,
          _messageBody
        ].join('');
        const mailBody = new Buffer.from(_mailBody).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
        (async () => {
          const response = await gmail.users.messages.send({
            userId: 'me',
            resource: {
              raw: mailBody
            }
          });
          console.log(response.data);
        })();
    }
});

(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');
})();