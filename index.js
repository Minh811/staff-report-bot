const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();

// === CONFIG ===
const TOKEN = "YOUR_BOT_TOKEN";
const REPORT_CHANNEL_ID = "ID_KÊNH_TỔNG_KẾT"; // ví dụ: 130000000000000000
const DATA_DIR = path.join(__dirname, "data");

// === Load commands ===
const commandFiles = fs.readdirSync("./commands").filter(f => f.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// === Command handler ===
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "❌ Lỗi khi thực hiện lệnh.", ephemeral: true });
  }
});

// === Hàm đọc dữ liệu trong ngày ===
function getTodayFilePath() {
  const today = new Date().toLocaleDateString("vi-VN").replace(/\//g, "-");
  return path.join(DATA_DIR, `${today}.json`);
}

function getStaffData() {
  const filePath = getTodayFilePath();
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// === Hàm gửi báo cáo ===
async function sendReport() {
  const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
  const staffData = getStaffData();

  const today = new Date().toLocaleDateString("vi-VN");
  if (!staffData.length) {
    return channel.send(`⚠️ Không có dữ liệu nào để tổng kết ngày ${today}!`);
  }

  let report = `📊 **BÁO CÁO NGÀY ${today}**\n\n`;
  for (const s of staffData) {
    report += `👤 **${s.name}** — 💬 Help: ${s.help}\n`;
  }

  await channel.send(report);

  // Xóa file cũ để bắt đầu ngày mới
  fs.unlinkSync(getTodayFilePath());
  console.log("✅ Đã gửi báo cáo & xóa dữ liệu cũ");
}

// === Hẹn giờ 0h mỗi ngày ===
cron.schedule("0 0 * * *", () => {
  console.log("⏰ Tổng kết sau 0h...");
  sendReport();
}, {
  timezone: "Asia/Ho_Chi_Minh"
});

client.once("ready", () => {
  console.log(`✅ Bot đã online: ${client.user.tag}`);
});

client.login(TOKEN);
