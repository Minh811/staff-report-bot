import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { parse } from 'json2csv';
import express from 'express';
import ExcelJS from 'exceljs';

// =====================
// Biến môi trường
// =====================
const token = process.env.DISCORD_TOKEN;
const ownerId = process.env.OWNER_ID;
const logChannelId = process.env.LOG_CHANNEL_ID;
const reportChannelId = process.env.REPORT_CHANNEL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// =====================
// Khởi tạo bot
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================
// Thư mục dữ liệu
// =====================
const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const exportDir = path.resolve('./exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);
const backupDir = path.resolve('./backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
const logsDir = path.resolve('./logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// =====================
// Logging System
// =====================
function getLogFile() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `${today}.log`);
}

function addLog(action, details = '') {
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const logMsg = `[${timestamp}] ${action}: ${details}\n`;
  try {
    fs.appendFileSync(getLogFile(), logMsg);
  } catch (err) {
    console.error('❌ Lỗi ghi log:', err);
  }
}

// =====================
// Error Tracking
// =====================
let errorLog = [];
const maxErrors = 100;

function trackError(err, context = '') {
  const errorEntry = {
    timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    message: err.message,
    code: err.code || 'UNKNOWN',
    context: context,
    stack: err.stack?.split('\n')[0] || ''
  };
  
  errorLog.push(errorEntry);
  if (errorLog.length > maxErrors) {
    errorLog.shift();
  }
  
  addLog('ERROR', `${context}: ${err.message}`);
  console.error(`❌ [${context}]`, err.message);
}

// =====================
// Rate Limit System
// =====================
const userCooldowns = new Map();
const COOLDOWN_MS = 3000; // 3 giây

function checkCooldown(userId) {
  const now = Date.now();
  const lastUse = userCooldowns.get(userId) || 0;
  if (now - lastUse < COOLDOWN_MS) {
    return false; // Still in cooldown
  }
  userCooldowns.set(userId, now);
  return true;
}

function getCooldownRemaining(userId) {
  const now = Date.now();
  const lastUse = userCooldowns.get(userId) || 0;
  const remaining = COOLDOWN_MS - (now - lastUse);
  return Math.ceil(remaining / 1000);
}

// =====================
// Dữ liệu và File
// =====================
function getTodayFile() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(dataDir, `${today}.json`);
}

function getDateFile(dateStr) {
  return path.join(dataDir, `${dateStr}.json`);
}

function loadDataFromDate(dateStr) {
  const file = getDateFile(dateStr);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file));
    } catch (err) {
      return {};
    }
  }
  return {};
}

let staffData = {};
const todayFile = getTodayFile();
if (fs.existsSync(todayFile)) {
  try {
    staffData = JSON.parse(fs.readFileSync(todayFile));
  } catch (err) {
    console.error('⚠️ Lỗi đọc file:', err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(getTodayFile(), JSON.stringify(staffData, null, 2));
    addLog('SAVE', `Data saved: ${Object.keys(staffData).length} users`);
  } catch (err) {
    trackError(err, 'saveData');
  }
}

// =====================
// Hàm Undo - Hoàn tác lần ghi nhận cuối
// =====================
function undoLastEntry(userId) {
  if (!staffData[userId]) {
    return { success: false, message: 'Không tìm thấy dữ liệu của bạn' };
  }

  const logs = staffData[userId].logs || [];
  if (logs.length === 0) {
    return { success: false, message: 'Không có lần ghi nhận nào để hoàn tác' };
  }

  const lastLog = logs.pop();
  staffData[userId].count -= lastLog.count;

  if (staffData[userId].count < 0) {
    staffData[userId].count = 0;
  }

  saveData();
  addLog('UNDO', `${staffData[userId].tag}: -${lastLog.count} help (từ ${lastLog.time})`);

  return {
    success: true,
    message: `✅ Hoàn tác thành công: -${lastLog.count} help`,
    removedLog: lastLog
  };
}

// =====================
// Hàm thống kê chi tiết
// =====================
function getDetailStats(userId, dateStr) {
  const data = loadDataFromDate(dateStr);
  if (!data[userId]) {
    return null;
  }

  const sorted = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
  const rank = sorted.findIndex(([uid]) => uid === userId) + 1;

  return {
    tag: data[userId].tag,
    count: data[userId].count,
    logs: data[userId].logs || [],
    rank: rank,
    total: sorted.length,
    date: dateStr
  };
}

// =====================
// Hàm xem thống kê cá nhân
// =====================
function getPersonalStats(userId, dateStr) {
  const data = loadDataFromDate(dateStr);
  if (!data[userId]) {
    return null;
  }

  const sorted = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
  const rank = sorted.findIndex(([uid]) => uid === userId) + 1;

  return {
    tag: data[userId].tag,
    count: data[userId].count,
    logs: data[userId].logs || [],
    rank: rank,
    total: sorted.length
  };
}

// =====================
// Hàm tính tuần
// =====================
function getWeeklyStats() {
  const today = new Date();
  const weekData = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const data = loadDataFromDate(dateStr);

    Object.entries(data).forEach(([uid, userData]) => {
      if (!weekData[uid]) {
        weekData[uid] = { tag: userData.tag, count: 0, logs: [] };
      }
      weekData[uid].count += userData.count;
      if (userData.logs) {
        weekData[uid].logs.push(...userData.logs.map(l => ({ ...l, date: dateStr })));
      }
    });
  }

  return weekData;
}

// =====================
// Hàm xuất CSV
// =====================
function exportToCSV(data, fileName) {
  try {
    const dataArray = Object.entries(data).map(([uid, d]) => ({
      'Tên Nhân Viên': d.tag,
      'Tổng Help': d.count,
      'Lịch Sử': d.logs ? d.logs.map(l => `${l.count} help lúc ${l.time}`).join(' | ') : 'Không có'
    }));

    const fields = ['Tên Nhân Viên', 'Tổng Help', 'Lịch Sử'];
    const csv = parse(dataArray, { fields });

    const filePath = path.join(exportDir, fileName);
    fs.writeFileSync(filePath, csv, 'utf8');

    addLog('EXPORT_CSV', fileName);
    return { success: true, filePath, fileName };
  } catch (err) {
    trackError(err, 'exportToCSV');
    return { success: false, error: err.message };
  }
}

// =====================
// Hàm xuất Excel
// =====================
async function exportToExcel(data, fileName) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Help Report');

    worksheet.columns = [
      { header: 'Xếp Hạng', key: 'rank', width: 12 },
      { header: 'Tên Nhân Viên', key: 'tag', width: 20 },
      { header: 'Tổng Help', key: 'count', width: 15 },
      { header: 'Lịch Sử', key: 'logs', width: 40 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };

    const sorted = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
    sorted.forEach(([uid, userData], index) => {
      const logsText = userData.logs
        ? userData.logs.map(l => `${l.count} help lúc ${l.time}`).join('\n')
        : 'Không có';

      worksheet.addRow({
        rank: index + 1,
        tag: userData.tag,
        count: userData.count,
        logs: logsText
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(3).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        };
      }
    });

    const filePath = path.join(exportDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    addLog('EXPORT_EXCEL', fileName);
    return { success: true, filePath, fileName };
  } catch (err) {
    trackError(err, 'exportToExcel');
    return { success: false, error: err.message };
  }
}

// =====================
// Hàm Backup tự động
// =====================
function createBackup() {
  try {
    const backupData = {
      timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      data: staffData,
      dataDir: fs.readdirSync(dataDir).map(f => ({
        file: f,
        content: JSON.parse(fs.readFileSync(path.join(dataDir, f)))
      }))
    };

    const fileName = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
    const filePath = path.join(backupDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    addLog('BACKUP', fileName);
    console.log(`✅ Backup: ${fileName}`);
    return fileName;
  } catch (err) {
    trackError(err, 'createBackup');
  }
}

// =====================
// Hàm tổng kết
// =====================
async function generateReport(resetAfter = false) {
  const reportChannel = await client.channels.fetch(reportChannelId);
  if (!reportChannel) return { success: false, message: 'Không tìm thấy kênh report!' };

  if (Object.keys(staffData).length === 0) {
    await reportChannel.send('📊 Không có dữ liệu help hôm nay.');
    addLog('REPORT', 'No data');
    return { success: true, message: 'Không có dữ liệu' };
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const timeStr = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const sorted = Object.entries(staffData).sort((a, b) => b[1].count - a[1].count);
  const total = sorted.reduce((s, [, d]) => s + d.count, 0);

  let msg = `📅 **Ngày:** ${dateStr}\n⏰ **Giờ tổng kết:** ${timeStr}\n👥 **Số nhân viên:** ${sorted.length}\n📈 **Tổng help:** ${total}\n\n`;

  sorted.forEach(([uid, data], i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
    msg += `${medal} <@${uid}> - **${data.count}** help\n`;
    if (data.logs && data.logs.length > 0) {
      msg += data.logs.map(log => `   • +${log.count} lúc ${log.time}`).join('\n') + '\n';
    }
  });

  const embed = new EmbedBuilder()
    .setTitle('📊 TỔNG KẾT SỐ HELP')
    .setDescription(msg)
    .setColor('Blue')
    .setFooter({ text: '✨ Cảm ơn mọi người đã cố gắng! ✨' })
    .setTimestamp();

  await reportChannel.send({ embeds: [embed] });

  // Export CSV
  const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`;
  const result = exportToCSV(staffData, fileName);
  if (result.success) {
    console.log(`✅ Export CSV: ${fileName}`);
  }

  // Reset data nếu cần
  if (resetAfter) {
    Object.keys(staffData).forEach(uid => {
      staffData[uid].count = 0;
      staffData[uid].logs = [];
    });
    saveData();
    addLog('RESET', 'Count and logs reset after report');
    console.log('🔄 Đã reset count và logs sau tổng kết.');
  }

  return { success: true, message: 'Đã tổng kết thành công' };
}

// =====================
// Slash Commands
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Ghi nhận số help cho bạn')
    .addIntegerOption(opt =>
      opt.setName('số_lượng')
        .setDescription('Số help muốn ghi nhận')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Xem thống kê help của bạn')
    .addUserOption(opt =>
      opt.setName('người')
        .setDescription('Xem stats của người khác (tuỳ chọn)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('ngày')
        .setDescription('Ngày cần xem (YYYY-MM-DD, mặc định hôm nay)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('stats-detail')
    .setDescription('Xem chi tiết help của bạn (giờ ghi nhận, số lượng)')
    .addStringOption(opt =>
      opt.setName('ngày')
        .setDescription('Ngày cần xem (YYYY-MM-DD, mặc định hôm nay)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('undo')
    .setDescription('Hoàn tác lần ghi nhận help cuối cùng'),
  new SlashCommandBuilder()
    .setName('lichsuhelp')
    .setDescription('Xem lịch sử help theo ngày')
    .addStringOption(opt =>
      opt.setName('ngày')
        .setDescription('Ngày cần xem (YYYY-MM-DD)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('tophelptuan')
    .setDescription('Xem top help tuần này'),
  new SlashCommandBuilder()
    .setName('bangxephang')
    .setDescription('Xem bảng xếp hạng help hôm nay'),
  new SlashCommandBuilder()
    .setName('tongket')
    .setDescription('Tổng kết số help hôm nay'),
  new SlashCommandBuilder()
    .setName('xuatcsv')
    .setDescription('Xuất file CSV hôm nay (chủ bot dùng)'),
  new SlashCommandBuilder()
    .setName('xuatexcel')
    .setDescription('Xuất file Excel hôm nay (chủ bot dùng)'),
  new SlashCommandBuilder()
    .setName('admin-reset')
    .setDescription('Reset help của 1 nhân viên (chủ bot)')
    .addUserOption(opt =>
      opt.setName('người')
        .setDescription('Người cần reset')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('admin-set')
    .setDescription('Chỉnh sửa số help của nhân viên (chủ bot)')
    .addUserOption(opt =>
      opt.setName('người')
        .setDescription('Người cần chỉnh sửa')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('số')
        .setDescription('Số help mới')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ bot'),
  new SlashCommandBuilder()
    .setName('ntin')
    .setDescription('Gửi tin nhắn')
    .addStringOption(opt =>
      opt.setName('noidung')
        .setDescription('Nội dung tin nhắn muốn gửi')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Xóa tin nhắn trong kênh (chủ bot)')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Số lượng tin muốn xóa (1–100)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('errors')
    .setDescription('Xem lỗi gần đây (chủ bot)'),
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Xem file log hôm nay (chủ bot)'),
].map(c => c.toJSON());

// đăng ký slash command
const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    console.log('🔄 Đăng ký slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands đã sẵn sàng!');
    addLog('STARTUP', 'Slash commands registered');
  } catch (err) {
    trackError(err, 'registerCommands');
  }
})();

// =====================
// Bot clientReady
// =====================
client.once('clientReady', async () => {
  console.log(`✅ Bot đăng nhập: ${client.user.tag}`);
  addLog('LOGIN', `Bot logged in as ${client.user.tag}`);
  
  const statusChannelId = '1437383067713929285';
  const channel = await client.channels.fetch(statusChannelId).catch(() => null);
  if (channel) {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    channel.send(`🟢 **Bot đã hoạt động!**\n⏰ Thời gian: ${now}`);
  } else {
    console.log('⚠️ Không tìm thấy kênh trạng thái, kiểm tra lại ID.');
  }
});

// =====================
// Hàm tiện ích safe reply
// =====================
async function safeReply(interaction, options) {
  try {
    if (interaction.deferred) {
      return await interaction.editReply(options);
    }
    if (interaction.replied) {
      return await interaction.followUp(options);
    }
    return await interaction.reply(options);
  } catch (err) {
    const code = err?.rawError?.code ?? err?.code;
    if (code === 10062 || code === 40060) {
      console.warn(`⚠️ Interaction expired (code: ${code})`);
      return;
    }

    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply(options);
      }
      if (interaction.replied) {
        return await interaction.followUp(options);
      }
    } catch (fallbackErr) {
      const fcode = fallbackErr?.rawError?.code ?? fallbackErr?.code;
      if (fcode === 10062 || fcode === 40060) {
        console.warn('⚠️ Interaction already acknowledged');
        return;
      }
      console.error('safeReply fallback lỗi:', fallbackErr);
    }

    trackError(err, 'safeReply');
  }
}

// =====================
// Xử lý lệnh
// =====================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;
  const userId = interaction.user.id;

  try {
    if (commandName === 'ping') {
      await safeReply(interaction, { content: `🏓 Ping: ${client.ws.ping}ms`, flags: 64 });
      addLog('CMD_PING', userId);
      return;
    }

    if (commandName === 'stats') {
      const targetUser = interaction.options.getUser('người') || interaction.user;
      const dateStr = interaction.options.getString('ngày') || new Date().toISOString().split('T')[0];

      const stats = getPersonalStats(targetUser.id, dateStr);

      if (!stats) {
        await safeReply(interaction, { content: `❌ Không tìm thấy dữ liệu của <@${targetUser.id}> vào ngày ${dateStr}`, flags: 64 });
        return;
      }

      let logsText = '';
      if (stats.logs.length > 0) {
        logsText = stats.logs.map(log => `• +${log.count} lúc ${log.time}`).join('\n');
      } else {
        logsText = 'Không có dữ liệu';
      }

      const embed = new EmbedBuilder()
        .setTitle(`📊 Thống Kê Help - ${stats.tag}`)
        .setDescription(`
**Ngày:** ${dateStr}
**Tổng Help:** ${stats.count}
**Xếp Hạng:** #${stats.rank}/${stats.total}

**Lịch Sử:**
${logsText}
        `)
        .setColor('Blue')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_STATS', `${targetUser.id}: ${stats.count} help`);
      return;
    }

    if (commandName === 'stats-detail') {
      const dateStr = interaction.options.getString('ngày') || new Date().toISOString().split('T')[0];
      const stats = getDetailStats(userId, dateStr);

      if (!stats) {
        await safeReply(interaction, { content: `❌ Không tìm thấy dữ liệu của bạn vào ngày ${dateStr}`, flags: 64 });
        return;
      }

      let detailMsg = `📊 **Chi Tiết Help - ${stats.tag}**\n\n`;
      detailMsg += `**Ngày:** ${dateStr}\n`;
      detailMsg += `**Tổng Help:** ${stats.count}\n`;
      detailMsg += `**Xếp Hạng:** #${stats.rank}/${stats.total}\n\n`;
      detailMsg += `**📋 Lịch Sử Chi Tiết:**\n`;

      if (stats.logs.length > 0) {
        stats.logs.forEach((log, i) => {
          detailMsg += `${i + 1}. **+${log.count}** help lúc **${log.time}**\n`;
        });
      } else {
        detailMsg += 'Không có ghi nhận nào hôm nay.';
      }

      const embed = new EmbedBuilder()
        .setDescription(detailMsg)
        .setColor('Blue')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_STATS_DETAIL', userId);
      return;
    }

    if (commandName === 'undo') {
      const result = undoLastEntry(userId);

      const color = result.success ? 'Green' : 'Red';
      const embed = new EmbedBuilder()
        .setDescription(result.message)
        .setColor(color);

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      if (result.success) {
        addLog('CMD_UNDO', `${interaction.user.tag}: -${result.removedLog.count}`);
      }
      return;
    }

    if (commandName === 'lichsuhelp') {
      const dateStr = interaction.options.getString('ngày') || new Date().toISOString().split('T')[0];
      const data = loadDataFromDate(dateStr);

      if (Object.keys(data).length === 0) {
        await safeReply(interaction, { content: `📊 Không có dữ liệu help vào ngày ${dateStr}`, flags: 64 });
        return;
      }

      const sorted = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
      const total = sorted.reduce((s, [, d]) => s + d.count, 0);

      let msg = `📅 **Ngày:** ${dateStr}\n👥 **Số nhân viên:** ${sorted.length}\n📈 **Tổng help:** ${total}\n\n`;

      sorted.forEach(([uid, userData], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        msg += `${medal} ${userData.tag} - **${userData.count}** help\n`;
        if (userData.logs && userData.logs.length > 0) {
          msg += userData.logs.map(log => `   • +${log.count} lúc ${log.time}`).join('\n') + '\n';
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('📊 Lịch Sử Help')
        .setDescription(msg)
        .setColor('Blue')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_LICHSUHELP', dateStr);
      return;
    }

    if (commandName === 'tophelptuan') {
      const weekData = getWeeklyStats();

      if (Object.keys(weekData).length === 0) {
        await safeReply(interaction, { content: '📊 Không có dữ liệu tuần này', flags: 64 });
        return;
      }

      const sorted = Object.entries(weekData).sort((a, b) => b[1].count - a[1].count);
      const total = sorted.reduce((s, [, d]) => s + d.count, 0);

      let msg = `📊 **Thống Kê Tuần Này**\n👥 **Số nhân viên:** ${sorted.length}\n📈 **Tổng help:** ${total}\n\n`;

      sorted.forEach(([uid, userData], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        msg += `${medal} ${userData.tag} - **${userData.count}** help\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle('📈 TOP HELP TUẦN NÀY')
        .setDescription(msg)
        .setColor('Gold')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_TOPHELPTUAN', 'Viewed');
      return;
    }

    if (commandName === 'bangxephang') {
      if (Object.keys(staffData).length === 0) {
        await safeReply(interaction, { content: '📊 Không có dữ liệu help hôm nay', flags: 64 });
        return;
      }

      const sorted = Object.entries(staffData).sort((a, b) => b[1].count - a[1].count);
      const total = sorted.reduce((s, [, d]) => s + d.count, 0);

      let msg = `📅 **Ngày:** ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n👥 **Số nhân viên:** ${sorted.length}\n📈 **Tổng help:** ${total}\n\n`;

      sorted.forEach(([uid, data], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        msg += `${medal} <@${uid}> - **${data.count}** help\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🏆 BẢNG XẾP HẠNG HELP HÔM NAY')
        .setDescription(msg)
        .setColor('Gold')
        .setFooter({ text: '🎉 Chúc mừng các bạn!' })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_BANGXEPHANG', 'Viewed');
      return;
    }

    if (commandName === 'ntin') {
      if (interaction.user.id !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      const content = interaction.options.getString('noidung');

      const embed = new EmbedBuilder()
        .setDescription(content)
        .setColor('Blue')
        .setFooter({ text: `Gửi bởi ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      await safeReply(interaction, { content: '✅ Tin nhắn đã được gửi!', flags: 64 });
      addLog('CMD_NTIN', `Content: ${content.substring(0, 50)}`);
      return;
    }

    if (commandName === 'help') {
      // Rate limit check
      if (!checkCooldown(userId)) {
        const remaining = getCooldownRemaining(userId);
        await safeReply(interaction, { content: `⏳ Vui lòng đợi ${remaining}s trước khi ghi nhận lần tiếp theo!`, flags: 64 });
        return;
      }

      const uid = interaction.user.id;

      if (!staffData[uid]) {
        staffData[uid] = { tag: interaction.user.tag, count: 0, logs: [] };
      }

      const count = interaction.options.getInteger('số_lượng') || 1;
      staffData[uid].count += count;

      const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      staffData[uid].logs.push({ count, time: now });

      saveData();

      const embed = new EmbedBuilder()
        .setDescription(`✅ Đã ghi nhận **${count} help** cho bạn lúc ${now}`)
        .setColor('Green');

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_HELP', `${interaction.user.tag}: +${count}`);
      return;
    }

    if (commandName === 'admin-reset') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      const targetUser = interaction.options.getUser('người');
      const targetUserId = targetUser.id;

      if (!staffData[targetUserId]) {
        await safeReply(interaction, { content: `❌ Không tìm thấy dữ liệu của <@${targetUserId}>`, flags: 64 });
        return;
      }

      const oldCount = staffData[targetUserId].count;
      staffData[targetUserId].count = 0;
      staffData[targetUserId].logs = [];

      saveData();

      const embed = new EmbedBuilder()
        .setDescription(`✅ Đã reset help của <@${targetUserId}> từ **${oldCount}** → **0**`)
        .setColor('Green');

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('ADMIN_RESET', `${targetUser.tag}: ${oldCount} → 0`);
      return;
    }

    if (commandName === 'admin-set') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      const targetUser = interaction.options.getUser('người');
      const targetUserId = targetUser.id;
      const newCount = interaction.options.getInteger('số');

      if (!staffData[targetUserId]) {
        staffData[targetUserId] = { tag: targetUser.tag, count: 0, logs: [] };
      }

      const oldCount = staffData[targetUserId].count;
      staffData[targetUserId].count = newCount;

      saveData();

      const embed = new EmbedBuilder()
        .setDescription(`✅ Đã chỉnh sửa help của <@${targetUserId}> từ **${oldCount}** → **${newCount}**`)
        .setColor('Green');

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('ADMIN_SET', `${targetUser.tag}: ${oldCount} → ${newCount}`);
      return;
    }

    if (commandName === 'tongket') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      await safeReply(interaction, { content: '⏳ Đang tổng kết...', flags: 64 });
      const result = await generateReport(true);
      const color = result.success ? 'Green' : 'Red';
      const embed = new EmbedBuilder()
        .setDescription(result.message)
        .setColor(color);
      await interaction.followUp({ embeds: [embed], flags: 64 });
      addLog('CMD_TONGKET', 'Report generated and reset');
      return;
    }

    if (commandName === 'xuatcsv') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      if (Object.keys(staffData).length === 0) {
        await safeReply(interaction, { content: '📊 Không có dữ liệu help hôm nay để xuất!', flags: 64 });
        return;
      }

      await interaction.deferReply({ flags: 64 });

      const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`;
      const result = exportToCSV(staffData, fileName);

      if (!result.success) {
        await interaction.editReply({ content: `⚠️ Lỗi khi xuất CSV: ${result.error}` });
        return;
      }

      const stats = fs.statSync(result.filePath);
      const maxSize = 8 * 1024 * 1024;
      if (stats.size > maxSize) {
        const fileUrl = `http://localhost:3000/exports/${encodeURIComponent(result.fileName)}`;
        await interaction.editReply({ content: `📥 File quá lớn để gửi trực tiếp (${Math.round(stats.size / 1024 / 1024)} MB). Tải tại: ${fileUrl}` });
        return;
      }

      try {
        const file = new AttachmentBuilder(result.filePath, { name: result.fileName });
        const embed = new EmbedBuilder()
          .setTitle('📥 Xuất CSV Thành Công')
          .setDescription(`✅ File **${result.fileName}** đã được tạo.\n\n📊 Tổng nhân viên: **${Object.keys(staffData).length}**`)
          .setColor('Green')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], files: [file] });
        console.log(`✅ Xuất CSV thành công: ${fileName}`);
      } catch (err) {
        trackError(err, 'xuatcsv');
        await interaction.editReply({ content: '⚠️ Lỗi khi gửi file CSV.' });
      }
      return;
    }

    if (commandName === 'xuatexcel') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      if (Object.keys(staffData).length === 0) {
        await safeReply(interaction, { content: '📊 Không có dữ liệu help hôm nay để xuất!', flags: 64 });
        return;
      }

      await interaction.deferReply({ flags: 64 });

      const fileName = `report-${new Date().toISOString().split('T')[0]}.xlsx`;
      const result = await exportToExcel(staffData, fileName);

      if (!result.success) {
        await interaction.editReply({ content: `⚠️ Lỗi khi xuất Excel: ${result.error}` });
        return;
      }

      try {
        const file = new AttachmentBuilder(result.filePath, { name: result.fileName });
        const embed = new EmbedBuilder()
          .setTitle('📊 Xuất Excel Thành Công')
          .setDescription(`✅ File **${result.fileName}** đã được tạo.\n\n📊 Tổng nhân viên: **${Object.keys(staffData).length}**`)
          .setColor('Green')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], files: [file] });
        console.log(`✅ Xuất Excel thành công: ${fileName}`);
      } catch (err) {
        trackError(err, 'xuatexcel');
        await interaction.editReply({ content: '⚠️ Lỗi khi gửi file Excel.' });
      }
      return;
    }

    if (commandName === 'errors') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      if (errorLog.length === 0) {
        await safeReply(interaction, { content: '✅ Không có lỗi nào được ghi nhận!', flags: 64 });
        return;
      }

      let errorMsg = '**📋 Lỗi Gần Đây:**\n\n';
      errorLog.slice(-10).reverse().forEach((err, i) => {
        errorMsg += `**${i + 1}. [${err.timestamp}]**\n`;
        errorMsg += `   Code: \`${err.code}\`\n`;
        errorMsg += `   Message: ${err.message}\n`;
        errorMsg += `   Context: ${err.context}\n\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle('❌ Error Log')
        .setDescription(errorMsg)
        .setColor('Red')
        .setFooter({ text: `Tổng lỗi: ${errorLog.length}` })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], flags: 64 });
      addLog('CMD_ERRORS', `Viewed ${errorLog.length} errors`);
      return;
    }

    if (commandName === 'logs') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      const logFile = getLogFile();
      if (!fs.existsSync(logFile)) {
        await safeReply(interaction, { content: '📋 Chưa có log file hôm nay.', flags: 64 });
        return;
      }

      try {
        const file = new AttachmentBuilder(logFile, { name: `logs-${new Date().toISOString().split('T')[0]}.log` });
        const embed = new EmbedBuilder()
          .setTitle('📋 Log File')
          .setDescription(`✅ File log của hôm nay`)
          .setColor('Blue')
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed], files: [file] });
        addLog('CMD_LOGS', 'Log file sent');
      } catch (err) {
        trackError(err, 'logs');
        await safeReply(interaction, { content: '⚠️ Lỗi khi gửi file log.' });
      }
      return;
    }

    if (commandName === 'clear') {
      if (userId !== ownerId) {
        await safeReply(interaction, { content: '❌ Chỉ chủ bot mới được dùng lệnh này!', flags: 64 });
        return;
      }

      const amount = interaction.options.getInteger('amount');
      if (amount < 1 || amount > 100) {
        await safeReply(interaction, { content: '⚠️ Số lượng phải từ 1–100!', flags: 64 });
        return;
      }

      const channel = interaction.channel;
      try {
        await channel.bulkDelete(amount, true);
        const embed = new EmbedBuilder()
          .setDescription(`🧹 Đã xóa **${amount}** tin nhắn thành công!`)
          .setColor('Blue');
        await safeReply(interaction, { embeds: [embed], flags: 64 });
        addLog('CMD_CLEAR', `${amount} messages deleted`);
      } catch (err) {
        trackError(err, 'clear');
        await safeReply(interaction, { content: '⚠️ Bot không có quyền xóa tin trong kênh này!', flags: 64 });
      }
      return;
    }
  } catch (err) {
    trackError(err, `interactionCreate: ${commandName}`);
    try {
      const errMsg = { content: '⚠️ Có lỗi xảy ra khi xử lý lệnh của bạn!' };
      if (interaction.deferred) {
        await interaction.editReply(errMsg);
      } else if (interaction.replied) {
        await interaction.followUp({ ...errMsg, flags: 64 });
      } else {
        await interaction.reply({ ...errMsg, flags: 64 });
      }
    } catch (replyErr) {
      console.error('❌ Lỗi phản hồi:', replyErr);
    }
  }
});

// =====================
// Cron jobs
// =====================
// Tổng kết 0h VN
cron.schedule('0 17 * * *', async () => {
  console.log('⏰ Tổng kết tự động lúc 0h VN...');
  addLog('CRON_REPORT', 'Auto report at midnight VN time');
  await generateReport(true);
});

// Backup mỗi ngày lúc 19h VN
cron.schedule('0 13 * * *', async () => {
  console.log('💾 Backup tự động...');
  createBackup();
});

// =====================
// Express server + serve exports
// =====================
const app = express();
app.use('/exports', express.static(path.join(process.cwd(), 'exports')));
app.use('/backups', express.static(path.join(process.cwd(), 'backups')));

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    botStatus: client.user ? 'online' : 'offline',
    uptime: Math.floor(process.uptime()),
    errors: errorLog.length,
    timestamp: Date.now()
  });
});

app.get('/errors', (req, res) => {
  res.json({ 
    total: errorLog.length, 
    errors: errorLog.slice(-20) 
  });
});

app.listen(3000, () => {
  console.log('🌐 Server online trên port 3000');
  addLog('STARTUP', 'Express server started on port 3000');
});

// =====================
// Login bot
// =====================
client.login(token);