const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wapenlevering')
    .setDescription('Registreer een wapenlevering aan een klant')
    .addStringOption(option =>
      option.setName('klant')
        .setDescription('De naam van de klant')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('wapen')
        .setDescription('Het wapen dat je wilt leveren')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('prijs')
        .setDescription('De prijs van het wapen')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('discord')
        .setDescription('Optioneel: De Discord gebruiker (als de klant in de Discord zit)')
        .setRequired(false)),
  
  async execute(interaction) {
    try {
      const geautoriseerdeLedenOp = interaction.client.haalGeautoriseerdeLedenOp();
      if (!geautoriseerdeLedenOp.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Je bent niet geautoriseerd om dit commando te gebruiken!', ephemeral: true });
      }
      
      let blacklist = [];
      try {
        const blacklistData = fs.readFileSync(path.join(__dirname, '../blacklist.json'), 'utf8');
        blacklist = JSON.parse(blacklistData);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van blacklist.json:', err);
        }
      }

      const isBlacklisted = blacklist.some(entry => entry.userId === interaction.user.id);
      if (isBlacklisted) {
        return interaction.reply({ content: 'Je staat op de blacklist en kunt geen wapens leveren!', ephemeral: true });
      }
      
      const klantNaam = interaction.options.getString('klant');
      const wapen = interaction.options.getString('wapen');
      const prijs = interaction.options.getInteger('prijs');
      const discordUser = interaction.options.getUser('discord');
      
      let wapenlijsten = {};
      try {
        const data = fs.readFileSync(path.join(__dirname, '../wapenlijsten.json'), 'utf8');
        wapenlijsten = JSON.parse(data);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van wapenlijsten.json:', err);
        }
      }
      
      if (!wapenlijsten[interaction.user.id] || !wapenlijsten[interaction.user.id].wapens.length) {
        return interaction.reply({ 
          content: `Je hebt geen wapens in je wapenlijst!`, 
          ephemeral: true 
        });
      }
      
      const wapenIndex = wapenlijsten[interaction.user.id].wapens.findIndex(w => w.naam.toLowerCase() === wapen.toLowerCase());
      if (wapenIndex === -1) {
        return interaction.reply({ 
          content: `Je hebt geen ${wapen} in je wapenlijst!`, 
          ephemeral: true 
        });
      }
      
      const geleverdWapen = wapenlijsten[interaction.user.id].wapens[wapenIndex];
      wapenlijsten[interaction.user.id].wapens.splice(wapenIndex, 1);
      fs.writeFileSync(path.join(__dirname, '../wapenlijsten.json'), JSON.stringify(wapenlijsten, null, 2));
      
      let leveringen = [];
      try {
        const data = fs.readFileSync(path.join(__dirname, '../wapenleveringen.json'), 'utf8');
        leveringen = JSON.parse(data);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van wapenleveringen.json:', err);
        }
      }
      
      const nieuweLevering = {
        id: Date.now().toString(),
        userId: interaction.user.id,
        username: interaction.user.tag,
        klant: klantNaam,
        wapen: geleverdWapen.naam,
        serienummer: geleverdWapen.serienummer,
        prijs: prijs,
        discordId: discordUser ? discordUser.id : null,
        discordTag: discordUser ? discordUser.tag : null,
        leveringsDatum: new Date().toLocaleString()
      };
      
      leveringen.push(nieuweLevering);
      fs.writeFileSync(path.join(__dirname, '../wapenleveringen.json'), JSON.stringify(leveringen, null, 2));
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔫 Wapen Geleverd')
        .setDescription(`Je hebt succesvol een wapen geleverd aan ${klantNaam}.`)
        .addFields(
          { name: 'Wapen', value: geleverdWapen.naam, inline: true },
          { name: 'Serienummer', value: geleverdWapen.serienummer, inline: true },
          { name: 'Prijs', value: `€${prijs}`, inline: true },
          { name: 'Klant', value: klantNaam, inline: true },
          { name: 'Discord', value: discordUser ? `<@${discordUser.id}>` : 'Geen Discord', inline: true },
          { name: 'Resterende wapens', value: `${wapenlijsten[interaction.user.id].wapens.length}`, inline: true }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      if (discordUser) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔫 Wapen Ontvangen')
            .setDescription(`Je hebt een wapen ontvangen van ${interaction.user.tag}.`)
            .addFields(
              { name: 'Wapen', value: geleverdWapen.naam, inline: true },
              { name: 'Serienummer', value: geleverdWapen.serienummer, inline: true },
              { name: 'Prijs', value: `€${prijs}`, inline: true }
            )
            .setTimestamp();
          
          await discordUser.send({ embeds: [dmEmbed] }).catch(() => {
            console.log(`Kon geen DM sturen naar ${discordUser.tag}`);
          });
        } catch (error) {
          console.error('Fout bij het sturen van DM:', error);
        }
      }
      
      await interaction.client.stuurLog(
        `👤 Dealer: <@${interaction.user.id}>\n` +
        `👥 Klant: ${klantNaam}${discordUser ? ` (<@${discordUser.id}>)` : ''}\n` +
        `🔫 Wapen: ${geleverdWapen.naam}\n` +
        `🔢 Serienummer: ${geleverdWapen.serienummer}\n` +
        `💰 Prijs: €${prijs}`,
        'wapens'
      );
    } catch (error) {
      console.error('Fout bij het uitvoeren van wapenlevering:', error);
      try {
        await interaction.reply({ 
          content: 'Er is een fout opgetreden bij het uitvoeren van dit commando.', 
          ephemeral: true 
        });
      } catch (replyError) {
        console.error('Fout bij reply:', replyError);
      }
    }
  }
};
