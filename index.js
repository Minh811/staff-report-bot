// Load biến môi trường
require('dotenv').config();

// Import Discord.js
const { Client, GatewayIntentBits } = require('discord.js');

// Khởi tạo client duy nhất
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Biến môi trường
const prefix = process.env.PREFIX;
const ownerId = process.env.OWNER_ID;
const token = process.env.DISCORD_TOKEN || process.env.TOKEN; // dùng TOKEN hoặc DISCORD_TOKEN

// Event khi bot đăng nhập thành công
client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập thành công với tên: ${client.user.tag}`);
});

// Event khi có tin nhắn
client.on('messageCreate', message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    message.channel.send('Pong!');
  }
});

// Login bot (chỉ 1 lần)
client.login(token);
