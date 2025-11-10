// Load dotenv
import 'dotenv/config';

// Import Discord.js
import { Client, GatewayIntentBits } from 'discord.js';

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
const token = process.env.DISCORD_TOKEN;
const reportChannelId = process.env.REPORT_CHANNEL_ID;

// Event khi bot đăng nhập thành công
client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
});

// Event khi có tin nhắn
client.on('messageCreate', async message => {
  // Bỏ qua tin nhắn bot hoặc không có prefix
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Lệnh ping cơ bản
  if (command === 'ping') {
    await message.channel.send('Pong!');
  }

  // Lệnh report nhân viên (staff-report)
  if (command === 'report') {
    if (!args[0]) {
      return message.reply('Vui lòng tag người bạn muốn report!');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('Không tìm thấy thành viên!');

    const reason = args.slice(1).join(' ') || 'Không có lý do cụ thể';

    // Gửi report vào kênh report
    const reportChannel = await client.channels.fetch(reportChannelId);
    if (!reportChannel) return message.reply('Không tìm thấy kênh report!');

    reportChannel.send(
      `⚠️ **Staff Report**\n` +
      `Người report: ${message.author.tag}\n` +
      `Người bị report: ${member.user.tag}\n` +
      `Lý do: ${reason}`
    );

    message.reply(`Đã gửi report về ${member.user.tag}`);
  }
});

// Login bot (chỉ 1 lần)
client.login(token);
