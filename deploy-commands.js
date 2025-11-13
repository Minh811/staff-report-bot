import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra trạng thái bot'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Ghi nhận số lần help hôm nay')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Số lần help')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('exportcsv')
    .setDescription('Xuất dữ liệu help ra file CSV (chỉ Owner)'),

  new SlashCommandBuilder()
    .setName('tongket')
    .setDescription('Tổng kết và gửi báo cáo (chỉ Owner)'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Đang đăng ký slash commands...');
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log('✅ Đăng ký slash commands thành công!');
} catch (error) {
  console.error(error);
}
