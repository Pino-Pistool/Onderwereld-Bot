const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('klantenlijst')
    .setDescription('Bekijk alle klanten'),
  
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen klantenlijst bekijken!', ephemeral: true });
    }
    
    let klanten = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../klanten.json'), 'utf8');
      klanten = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van klanten.json:', err);
      }
    }
    
    if (klanten.length === 0) {
      return interaction.reply({ content: 'Er zijn nog geen klanten aangemaakt.', ephemeral: true });
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('👥 Klantenlijst')
      .setDescription(`Totaal aantal klanten: ${klanten.length}`)
      .setTimestamp();
    
    // Maximaal 25 velden in een embed
    const klantenPerEmbed = 8;
    const totalEmbeds = Math.ceil(klanten.length / klantenPerEmbed);
    const embeds = [];
    
    for (let i = 0; i < totalEmbeds; i++) {
      const startIndex = i * klantenPerEmbed;
      const endIndex = Math.min(startIndex + klantenPerEmbed, klanten.length);
      const embedKlanten = klanten.slice(startIndex, endIndex);
      
      const pageEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`👥 Klantenlijst (Pagina ${i+1}/${totalEmbeds})`)
        .setDescription(`Totaal aantal klanten: ${klanten.length}`)
        .setTimestamp();
      
      for (const klant of embedKlanten) {
        const status = klant.blacklisted ? '🚫 Blacklisted' : '✅ Actief';
        const reden = klant.blacklisted ? `\nReden: ${klant.reden}` : '';
        
        pageEmbed.addFields({
          name: klant.naam,
          value: `📞 ${klant.telefoonnummer}\n📊 Status: ${status}${reden}`,
          inline: true
        });
      }
      
      embeds.push(pageEmbed);
    }
    
    // Stuur de eerste embed
    await interaction.reply({ embeds: [embeds[0]], ephemeral: true });
    
    // Als er meer embeds zijn, stuur ze als follow-up berichten
    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
    }
    
    await interaction.client.stuurLog(
      `👤 Gebruiker: <@${interaction.user.id}>\n` +
      `🔍 Heeft de klantenlijst opgevraagd`,
      'klanten'
    );
  }
};
