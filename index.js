import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { parse } from 'json2csv';
import express from 'express';

// =====================
// Khởi tạo bot Discord
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================
// Biến môi trường
// =====================
const token = process.env.DISCORD_TOKEN;
const logChannelId = process.env.LOG_CHANNEL_ID;
const reportChannelId = process.env.REPORT_CHANNEL_ID;
const prefix = process.env.PREFIX || '!';
const ownerId = process.env.OWNER_ID;

// =====================
// Thư mục lưu dữ liệu
// =====================
const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const exportDir = path.resolve('./exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

// =====================
// Lấy file data theo ngày
// =====================
function getTodayFile() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(dataDir, `${today}.json`);
}

// =====================
// Load dữ liệu ngày hôm nay
// =====================
let staffData = {};
const todayFile = getTodayFile();
if (fs.existsSync(todayFile)) {
  try {
    staffData = JSON.parse(fs.readFileSync(todayFile));
  } catch (err) {
    console.error('⚠️ Lỗi đọc file ngày hôm nay:', err);
  }
}

// =====================
// Lưu dữ liệu
// =====================
function saveData() {
  fs.writeFileSync(getTodayFile(), JSON.stringify(staffData, null, 2));
}

// =====================
// Hàm gửi trạng thái bot
// =====================
async function sendStatus() {
  try {
    const channel = await client.channels.fetch(reportChannelId);
    if (!channel) return console.log('Không tìm thấy kênh report!');
    channel.send(`🟢 Bot đang hoạt động - ${new Date().toLocaleString()}`);
  } catch (err) {
    console.error('Lỗi khi gửi trạng thái:', err);
  }
}

// =====================
// Hàm tổng kết & export CSV
// =====================
async function generateReport(shouldReset = false) {
  const reportChannel = await client.channels.fetch(reportChannelId);
  if (!reportChannel) {
    console.log('Không tìm thấy kênh report!');
    return { success: false, message: 'Không tìm thấy kênh report!' };
  }

  if (Object.keys(staffData).length === 0) {
    await reportChannel.send('📊 Không có dữ liệu help hôm nay.');
    return { success: true, message: 'Không có dữ liệu' };
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const sortedStaff = Object.entries(staffData).sort((a, b) => b[1].count - a[1].count);
  const totalHelps = sortedStaff.reduce((sum, [, data]) => sum + data.count, 0);

  let summary = '╔═══════════════════════════════════╗\n';
  summary += '║   📊 TỔNG KẾT SỐ HELP   ║\n';
  summary += '╚═══════════════════════════════════╝\n\n';
  summary += `📅 Ngày: ${dateStr}\n`;
  summary += `⏰ Giờ tổng kết: ${timeStr}\n`;
  summary += `👥 Số nhân viên: ${sortedStaff.length} người\n`;
  summary += `📈 Tổng help: ${totalHelps}\n\n`;
  summary += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  sortedStaff.forEach(([userId, data], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▪️';
    summary += `${medal} <@${userId}> - ${data.count} help\n`;
  });

  summary += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  summary += '✨ Cảm ơn các bạn đã cố gắng! ✨';

  await reportChannel.send(summary);

  // Export CSV
  try {
    const fields = ['tag', 'count'];
    const dataArray = Object.values(staffData);
    const csv = parse(dataArray, { fields });
    const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(path.join(exportDir, fileName), csv);
    console.log(`✅ Export CSV: ${fileName}`);
  } catch (err) {
    console.error('⚠️ Lỗi export CSV:', err);
  }

  if (shouldReset) {
    staffData = {};
    saveData();
  }

  return { success: true, message: 'Đã tổng kết thành công' };
}

// =====================
// Khi bot sẵn sàng
// =====================
client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
  sendStatus();
  setInterval(sendStatus, 3600000); // gửi trạng thái mỗi 1h
});

// =====================
// Thu thập dữ liệu help
// =====================
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

  if (command === 'exportcsv' && message.author.id === ownerId) {
    try {
      const fields = ['tag', 'count'];
      const dataArray = Object.values(staffData);
      const csv = parse(dataArray, { fields });
      const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(path.join(exportDir, fileName), csv);
      await message.reply(`✅ Export CSV thành công: ${fileName}`);
    } catch (err) {
      console.error(err);
      message.reply('⚠️ Lỗi khi export CSV.');
    }
  }

  if (command === 'tongket' && message.author.id === ownerId) {
    try {
      await message.reply('⏳ Đang tổng kết...');
      const result = await generateReport(false);
      if (result.success) await message.reply('✅ Đã gửi báo cáo tổng kết và export CSV!');
      else await message.reply(`⚠️ ${result.message}`);
    } catch (err) {
      console.error(err);
      await message.reply('⚠️ Lỗi khi tổng kết.');
    }
  }
});

// =====================
// Cron job tổng kết 0h giờ VN
// =====================
cron.schedule('0 17 * * *', async () => {
  console.log('⏰ Bắt đầu tổng kết tự động lúc 0h giờ Việt Nam...');
  await generateReport(true);
  console.log('✅ Hoàn thành tổng kết tự động');
});

// =====================
// Login bot
// =====================
client.login(token);

// =====================
// Express server đơn giản
// =====================
const app = express();
app.get('/', (req, res) => res.send('Bot đang chạy!'));
const PORT = 3000;
app.listen(PORT, () => console.log(`Server online trên port ${PORT}`));