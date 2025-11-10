const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập thành công với tên: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const prefix = process.env.PREFIX;
const ownerId = process.env.OWNER_ID;

client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

client.on('messageCreate', message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    message.channel.send('Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);

