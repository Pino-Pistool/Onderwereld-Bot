const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('klantcreate')
    .setDescription('Maak een nieuwe klant aan')
    .addStringOption(option => 
      option.setName('naam')
        .setDescription('De naam van de klant')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('telefoonnummer')
        .setDescription('Het telefoonnummer van de klant')
        .setRequired(true)),
  
  async execute(interaction) {
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen klanten aanmaken!', ephemeral: true });
    }
    
    const klantNaam = interaction.options.getString('naam');
    const telefoonnummer = interaction.options.getString('telefoonnummer');
    
    let klanten = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../klanten.json'), 'utf8');
      klanten = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van klanten.json:', err);
      }
    }
    
    const klantExists = klanten.some(k => k.naam.toLowerCase() === klantNaam.toLowerCase());
    if (klantExists) {
      return interaction.reply({ 
        content: `Klant "${klantNaam}" bestaat al!`, 
        ephemeral: true 
      });
    }
    
    const nieuweKlant = {
      naam: klantNaam,
      telefoonnummer: telefoonnummer,
      aangemaakt_door: interaction.user.tag,
      aangemaakt_door_id: interaction.user.id,
      aangemaakt_op: new Date().toLocaleString(),
      blacklisted: false,
      reden: ''
    };
    
    klanten.push(nieuweKlant);
    fs.writeFileSync(path.join(__dirname, '../klanten.json'), JSON.stringify(klanten, null, 2));
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('👥 Nieuwe Klant Aangemaakt')
      .setDescription(`Je hebt succesvol een nieuwe klant aangemaakt.`)
      .addFields(
        { name: 'Naam', value: klantNaam, inline: true },
        { name: 'Telefoonnummer', value: telefoonnummer, inline: true }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    await interaction.client.stuurLog(
      `👤 Dealer: <@${interaction.user.id}>\n` +
      `👥 Nieuwe klant: ${klantNaam}\n` +
      `📞 Telefoonnummer: ${telefoonnummer}`,
      'klanten'
    );
  }
};
