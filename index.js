require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const express = require('express');
const fetch = require('node-fetch');

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

// ---------------- Collections ----------------
client.tickets = new Collection();       // ticketID -> { userId, type, claimerId, channelId, createdAt }
client.promotions = new Collection();    // promotionID -> { userId, role, notes, issuerId, timestamp }
client.infractions = new Collection();   // infractionID -> { userId, type, notes, issuerId, timestamp }

// ---------------- Helpers ----------------
const PREFIX = process.env.PREFIX || '!';

function generateId(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function staffCheck(member) {
  return member.roles.cache.has(process.env.STAFF_TEAM_ID) ||
    member.roles.cache.has(process.env.MODERATION_TEAM_ID) ||
    member.roles.cache.has(process.env.ADMINISTRATION_TEAM_ID) ||
    member.roles.cache.has(process.env.SUPERVISORY_TEAM_ID) ||
    member.roles.cache.has(process.env.INTERNAL_AFFAIRS_TEAM_ID) ||
    member.roles.cache.has(process.env.MANAGEMENT_TEAM_ID) ||
    member.roles.cache.has(process.env.DIRECTIVE_TEAM_ID);
}

function isAdmin(member) {
  return member.roles.cache.has(process.env.ADMINISTRATION_TEAM_ID);
}

// ---------------- Auto-Unverified Join ----------------
client.on("guildMemberAdd", async (member) => {
  const unverifiedRole = member.guild.roles.cache.get(
    process.env.UNVERIFIED_ROLE_ID
  );

  if (!unverifiedRole) return;

  try {
    await member.roles.add(unverifiedRole);
    console.log(`Unverified role added to ${member.user.tag}`);
  } catch (err) {
    console.error("Failed to auto-role Unverified:", err);
  }
});

// ---------------- Ready ----------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('LARP Utilities | /help', { type: 3 });

  // Session embed updater
  setInterval(async () => {
    const channel = await client.channels.fetch(process.env.SESSION_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    // Fetch real playercount via ER:LC API (placeholder)
    const playerCount = Math.floor(Math.random() * 50);

    const embed = new EmbedBuilder()
      .setTitle('Session Status')
      .setDescription(`Players Online: **${playerCount}**`)
      .setColor('Blue')
      .setTimestamp();

    const pinned = (await channel.messages.fetchPinned()).first();
    if (pinned) pinned.edit({ embeds: [embed] });
    else channel.send({ embeds: [embed] }).then(msg => msg.pin());
  }, 2 * 60 * 1000);
});

// ---------------- Interaction Handler ----------------
client.on('interactionCreate', async interaction => {

  // ---------------- Slash Commands ----------------
  if (interaction.isChatInputCommand()) {
    const { commandName, member, guild } = interaction;

    // ---------------- /serverinfo ----------------
    if (commandName === 'serverinfo') {
      const staffRole = guild.roles.cache.get(process.env.STAFF_TEAM_ID);
      const staffCount = staffRole ? staffRole.members.size : 0;
      const owner = await guild.fetchOwner();

      const embed = new EmbedBuilder()
        .setTitle(`Server Info: ${guild.name}`)
        .addFields(
          { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Online Members', value: `${guild.members.cache.filter(m => m.presence?.status !== 'offline').size}`, inline: true },
          { name: 'Owner', value: `${owner}`, inline: true },
          { name: 'Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
          { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Staff', value: `${staffCount}`, inline: true }
        )
        .setColor('Blue')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ---------------- /membercount ----------------
    if (commandName === 'membercount') {
      const embed = new EmbedBuilder()
        .setTitle(`Member Count: ${guild.name}`)
        .addFields(
          { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Online Members', value: `${guild.members.cache.filter(m => m.presence?.status !== 'offline').size}`, inline: true }
        )
        .setColor('Green')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ---------------- /setup-verification ----------------
    if (commandName === "setup-verification") {

      if (!member.permissions.has("Administrator")) {
        return interaction.reply({
          content: "Only Administrators can set up verification.",
          ephemeral: true
        });
      }

      if (interaction.channel.id !== process.env.VERIFICATION_CHANNEL_ID) {
        return interaction.reply({
          content: "This command can only be used in the verification channel.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Los Angeles Roleplay Verification")
        .setDescription(
          "Welcome to **Los Angeles Roleplay**!\n\n" +
          "To verify, follow these steps:\n\n" +
          "1️⃣ Click **Link Roblox Account**\n" +
          "2️⃣ Complete the Bloxlink verification\n" +
          "3️⃣ Click **Finish Verification** to unlock the server\n\n" +
          "Thank you!"
        )
        .setColor("Green")
        .setFooter({ text: "LARP - Utilities Verification System" });

      const row = new ActionRowBuilder().addComponents(
        // Button 1: Link Roblox (link button)
        new ButtonBuilder()
          .setLabel("Link Roblox Account")
          .setStyle(ButtonStyle.Link)
          .setURL("https://blox.link/verify"),

        // Button 2: Finish Verification
        new ButtonBuilder()
          .setCustomId("verify_user")
          .setLabel("Finish Verification")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: "✅ Verification embed posted successfully.",
        ephemeral: true
      });
    }

    // ---------------- /promote ----------------
    if (commandName === 'promote') {
      if (!member.roles.cache.has(process.env.PROMOTION_PERMISSION_ID))
        return interaction.reply({ content: 'You do not have permission.', ephemeral: true });

      // Promotion logic placeholder
    }

    // ---------------- /infract ----------------
    if (commandName === 'infract') {
      if (!member.roles.cache.has(process.env.INFRACTION_PERMISSION_ID))
        return interaction.reply({ content: 'You do not have permission.', ephemeral: true });

      // Infraction logic placeholder
    }

    // ---------------- /loa-submit ----------------
    if (commandName === 'loa-submit') {
      // LOA logic placeholder
    }

    // ---------------- /void ----------------
    if (commandName === 'void') {
      // Void logic placeholder
    }

    // ---------------- Ticket Creation Placeholder ----------------
  }

  // ---------------- Button Interactions ----------------
  if (interaction.isButton()) {

    // ✅ Verification Button
    if (interaction.customId === "verify_user") {

      const bloxlinkVerified = interaction.guild.roles.cache.get(
        process.env.VERIFIED_ROLE_ID
      );

      const unverifiedRole = interaction.guild.roles.cache.get(
        process.env.UNVERIFIED_ROLE_ID
      );

      const communityRole = interaction.guild.roles.cache.get(
        process.env.COMMUNITY_ROLE_ID
      );

      // Must link Roblox first
      if (!interaction.member.roles.cache.has(bloxlinkVerified.id)) {
        return interaction.reply({
          content:
            "❌ You must link your Roblox account first.\n\n" +
            "Click the 'Link Roblox Account' button first, then try again.",
          ephemeral: true
        });
      }

      try {
        // Remove Unverified
        if (unverifiedRole) {
          await interaction.member.roles.remove(unverifiedRole);
        }

        // Add Community Member Role
        if (communityRole) {
          await interaction.member.roles.add(communityRole);
        }

        return interaction.reply({
          content: "✅ Verification complete! Welcome to **Los Angeles Roleplay** 🎉",
          ephemeral: true
        });

      } catch (err) {
        console.error("Verification error:", err);
        return interaction.reply({
          content: "❌ Verification failed. Please contact staff.",
          ephemeral: true
        });
      }
    }

    // ---------------- Ticket Buttons ----------------
    const ticket = client.tickets.get(interaction.channel.id);

    // Only return if it's not verification AND not a ticket
    if (!ticket && interaction.customId !== "verify_user") return;

    if (interaction.customId === 'claim_ticket') {

      const claimerId = interaction.user.id;

      if (ticket.claimerId === claimerId) {
        ticket.claimerId = null;

        interaction.update({
          content: `${interaction.user} has unclaimed this ticket. Any support staff may now respond.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Claim')
                .setStyle(ButtonStyle.Primary)
            )
          ],
          embeds: []
        });

      } else {

        ticket.claimerId = claimerId;

        interaction.update({
          content: `${interaction.user} has claimed this ticket. No other support representatives may speak in this channel, unless you unclaim this ticket.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Unclaim')
                .setStyle(ButtonStyle.Danger)
            )
          ],
          embeds: []
        });
      }
    }

    // Other buttons: close ticket, LOA accept/decline
  }

});

// ---------------- Prefix Commands ----------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);

  // Add prefix commands if needed
});

// ---------------- Ticket Permissions ----------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const ticket = client.tickets.get(message.channel.id);
  if (ticket) {
    const admin = message.member.roles.cache.has(process.env.ADMINISTRATION_TEAM_ID);

    if (ticket.claimerId && message.author.id !== ticket.claimerId && !admin) {
      return message.delete().catch(() => { });
    }
  }
});

// ---------------- Login ----------------
client.login(process.env.DISCORD_TOKEN);