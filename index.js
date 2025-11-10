import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { parse } from 'json2csv';

// Khởi tạo client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Biến môi trường
const token = process.env.DISCORD_TOKEN;
const logChannelId = process.env.LOG_CHANNEL_ID;
const reportChannelId = process.env.REPORT_CHANNEL_ID;
const prefix = process.env.PREFIX || '!';
const ownerId = process.env.OWNER_ID;

// Thư mục lưu dữ liệu
const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const exportDir = path.resolve('./exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

// Lấy file data theo ngày
function getTodayFile() {
  const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
  return path.join(dataDir, `${today}.json`);
}

// Load dữ liệu ngày hôm nay
let staffData = {};
const todayFile = getTodayFile();
if (fs.existsSync(todayFile)) {
  try {
    staffData = JSON.parse(fs.readFileSync(todayFile));
  } catch (err) {
    console.error('⚠️ Lỗi đọc file ngày hôm nay:', err);
  }
}

// Lưu dữ liệu
function saveData() {
  fs.writeFileSync(getTodayFile(), JSON.stringify(staffData, null, 2));
}

// Khi bot sẵn sàng
client.once('clientReady', () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
});

// Thu thập dữ liệu help
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== logChannelId) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    const count = parseInt(args[0]) || 1;
    const userId = message.author.id;

    if (!staffData[userId]) staffData[userId] = { tag: message.author.tag, count: 0 };
    staffData[userId].count += count;

    saveData();
    message.reply(`✅ Ghi nhận ${count} help cho bạn.`);
  }

  // Lệnh export CSV (chỉ owner)
  if (command === 'exportcsv' && message.author.id === ownerId) {
    try {
      const fields = ['tag', 'count'];
      const dataArray = Object.values(staffData);
      const csv = parse(dataArray, { fields });
      const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = path.join(exportDir, fileName);
      fs.writeFileSync(filePath, csv);
      await message.reply({ content: `✅ Export CSV thành công: ${fileName}` });
    } catch (err) {
      console.error(err);
      message.reply('⚠️ Lỗi khi export CSV.');
    }
  }
});

// Cron job tổng kết 0h hàng ngày
cron.schedule('0 0 * * *', async () => {
  const reportChannel = await client.channels.fetch(reportChannelId);
  if (!reportChannel) return console.log('Không tìm thấy kênh report!');

  if (Object.keys(staffData).length === 0) {
    await reportChannel.send('📊 Không có dữ liệu help hôm nay.');
    return;
  }

  let summary = '📊 **Tổng kết số help nhân viên hôm nay**\n\n';
  for (const userId in staffData) {
    summary += `${staffData[userId].tag}: ${staffData[userId].count}\n`;
  }

  await reportChannel.send(summary);

  // Tự động export CSV
  try {
    const fields = ['tag', 'count'];
    const dataArray = Object.values(staffData);
    const csv = parse(dataArray, { fields });
    const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(path.join(exportDir, fileName), csv);
    console.log(`✅ Export CSV tự động: ${fileName}`);
  } catch (err) {
    console.error('⚠️ Lỗi export CSV tự động:', err);
  }

  // Reset dữ liệu ngày mới
  staffData = {};
  saveData();
});

// Login bot
client.login(token);
