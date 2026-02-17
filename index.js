require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ---------------- Keep Alive ----------------
const app = express();
app.get('/', (req, res) => res.send('LARP Utilities Bot Running'));
app.listen(3000, () => console.log('Keep-alive server started'));

// ---------------- Helpers ----------------
const PREFIX = process.env.PREFIX || '!';

// ---------------- Command Registration ----------------
const commands = [
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Shows server information'),
  new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Shows online members and total members')
].map(cmd => cmd.toJSON());

// Register commands for a specific guild
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log('Bot is online');
  
  // Register commands in a specific server (guild)
  try {
    console.log('Started refreshing application (slash) commands.');

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, '<1472786387739742261>'), // Replace with your guild ID
      { body: commands }
    );

    console.log('Successfully reloaded application (slash) commands.');
  } catch (error) {
    console.error(error);
  }

  // Set bot status
  client.user.setActivity('LARP Utilities | /help', { type: 3 });
});

// ---------------- Interaction Handler ----------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  // ---------------- /serverinfo ----------------
  if (commandName === 'serverinfo') {
    const owner = await interaction.guild.fetchOwner();
    const staffRole = interaction.guild.roles.cache.get(process.env.STAFF_TEAM_ID);
    const embed = new EmbedBuilder()
      .setTitle(`Server Info: ${interaction.guild.name}`)
      .addFields(
        { name: 'Total Members', value: `${interaction.guild.memberCount}`, inline: true },
        { name: 'Owner', value: `${owner.user.tag}`, inline: true },
        { name: 'Staff', value: `${staffRole ? staffRole.members.size : 0}`, inline: true }
      )
      .setColor('Blue');

    return interaction.reply({ embeds: [embed] });
  }

  // ---------------- /membercount ----------------
  if (commandName === 'membercount') {
    const online = interaction.guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
    const embed = new EmbedBuilder()
      .setTitle(`Member Count: ${interaction.guild.name}`)
      .addFields(
        { name: 'Total Members', value: `${interaction.guild.memberCount}`, inline: true },
        { name: 'Online Members', value: `${online}`, inline: true }
      )
      .setColor('Green');

    return interaction.reply({ embeds: [embed] });
  }
});

// ---------------- Ready ----------------
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------------- Login ----------------
client.login(process.env.DISCORD_TOKEN);
