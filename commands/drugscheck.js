const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drugscheck')
    .setDescription('Bekijk drugshistorie van een klant')
    .addStringOption(option => 
      option.setName('klant')
        .setDescription('De naam van de klant')
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen drugshistorie bekijken!', ephemeral: true });
    }
    
    const klantNaam = interaction.options.getString('klant');
    
    let klanten = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../klanten.json'), 'utf8');
      klanten = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van klanten.json:', err);
      }
    }
    
    const klantObj = klanten.find(k => k.naam.toLowerCase() === klantNaam.toLowerCase());
    if (!klantObj) {
      return interaction.reply({ 
        content: `Klant "${klantNaam}" bestaat niet! Gebruik /klantcreate om een nieuwe klant aan te maken.`, 
        ephemeral: true 
      });
    }
    
    let drugsdeals = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../drugsdeals.json'), 'utf8');
      drugsdeals = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van drugsdeals.json:', err);
      }
    }
    
    const klantDeals = drugsdeals.filter(deal => 
      deal && 
      deal.klant && 
      deal.klant.toLowerCase() === klantNaam.toLowerCase()
    );
    
    if (klantDeals.length === 0) {
      return interaction.reply({ 
        content: `Klant "${klantNaam}" heeft nog geen drugsdeals gehad.`, 
        ephemeral: true 
      });
    }
    
    const sortedDeals = [...klantDeals].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    const drugTypes = {};
    let totalHoeveelheid = 0;
    let totalZakken = 0;
    
    sortedDeals.forEach(deal => {
      if (deal.drugssoort) {
        drugTypes[deal.drugssoort] = (drugTypes[deal.drugssoort] || 0) + 1;
      }
      if (deal.hoeveelheid) totalHoeveelheid += deal.hoeveelheid;
      if (deal.zakken) totalZakken += deal.zakken;
    });
    
    const drugsOverview = Object.entries(drugTypes)
      .map(([type, count]) => `${type}: ${count}x`)
      .join('\n');
    
    const mainEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`🌿 Drugshistorie voor ${klantNaam}`)
      .setDescription(`${klantNaam} heeft in totaal ${klantDeals.length} drugsdeals gehad.`)
      .addFields(
        { name: 'Telefoonnummer', value: klantObj.telefoonnummer || 'Onbekend', inline: true },
        { name: 'Status', value: klantObj.blacklisted ? `🚫 Blacklisted (${klantObj.reden || 'Geen reden'})` : '✅ Actief', inline: true },
        { name: 'Aangemaakt door', value: klantObj.aangemaakt_door || 'Onbekend', inline: true },
        { name: 'Aangemaakt op', value: klantObj.aangemaakt_op || 'Onbekend', inline: true },
        { name: 'Drugssoorten', value: drugsOverview || 'Geen data', inline: true },
        { name: 'Totaal hoeveelheid', value: `${totalHoeveelheid} stuks`, inline: true },
        { name: 'Totaal zakken', value: `${totalZakken} zak(ken)`, inline: true }
      )
      .setTimestamp();
    
    const dealEmbeds = [];
    
    for (let i = 0; i < Math.min(sortedDeals.length, 25); i++) {
      const deal = sortedDeals[i];
      
      const dealEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`🌿 Drugsdeal #${i + 1} voor ${klantNaam}`)
        .setTimestamp();
      
      const fields = [];
      
      if (deal.drugssoort) {
        fields.push({ name: 'Drugssoort', value: deal.drugssoort, inline: true });
      }
      
      if (deal.hoeveelheid !== undefined) {
        fields.push({ name: 'Hoeveelheid', value: `${deal.hoeveelheid} stuks`, inline: true });
      }
      
      if (deal.rate !== undefined) {
        fields.push({ name: 'Verhouding', value: `1:${deal.rate}`, inline: true });
      }
      
      if (deal.zakken !== undefined) {
        fields.push({ name: 'Zakken', value: `${deal.zakken} zak(ken)`, inline: true });
      }
      
      if (deal.userId) {
        fields.push({ name: 'Dealer', value: `<@${deal.userId}> (${deal.username || 'Onbekend'})`, inline: true });
      }
      
      if (deal.date || deal.timestamp) {
        fields.push({ name: 'Datum', value: deal.date || new Date(deal.timestamp).toLocaleString(), inline: true });
      }
      
      dealEmbed.addFields(fields);
      dealEmbeds.push(dealEmbed);
    }
    
    const rows = [];
    
    const overviewRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('overview')
          .setLabel('Overzicht')
          .setStyle(ButtonStyle.Primary)
      );
    
    rows.push(overviewRow);
    
    const maxDealsToShow = Math.min(sortedDeals.length, 24);
    const buttonsPerRow = 5;
    const numRows = Math.ceil(maxDealsToShow / buttonsPerRow);
    
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      const row = new ActionRowBuilder();
      
      for (let buttonIndex = 0; buttonIndex < buttonsPerRow; buttonIndex++) {
        const dealIndex = rowIndex * buttonsPerRow + buttonIndex;
        
        if (dealIndex < maxDealsToShow) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`deal_${dealIndex}`)
              .setLabel(`#${dealIndex + 1}`)
              .setStyle(ButtonStyle.Secondary)
          );
        }
      }
      
      if (row.components.length > 0) {
        rows.push(row);
      }
    }
    
    await interaction.reply({
      embeds: [mainEmbed],
      components: rows,
      ephemeral: true
    });
    
    const filter = i => (i.customId === 'overview' || i.customId.startsWith('deal_')) && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });
    
    collector.on('collect', async i => {
      try {
        if (i.customId === 'overview') {
          await i.deferUpdate();
          await i.editReply({ embeds: [mainEmbed], components: rows });
        } else if (i.customId.startsWith('deal_')) {
          const index = parseInt(i.customId.split('_')[1]);
          if (index >= 0 && index < dealEmbeds.length) {
            await i.deferUpdate();
            await i.editReply({ embeds: [dealEmbeds[index]], components: rows });
          }
        }
      } catch (error) {
        console.error('Fout bij verwerken van knop:', error);
      }
    });
    
    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        console.error('Fout bij het verwijderen van componenten na timeout:', error);
      }
    });
    
    await interaction.client.stuurLog(
      `👤 Gebruiker: <@${interaction.user.id}>\n` +
      `👥 Heeft drugshistorie bekeken van klant: ${klantNaam}\n` +
      `🌿 Drugssoorten: ${Object.keys(drugTypes).join(', ')}\n` +
      `📊 Totaal deals: ${klantDeals.length}`,
      'drugs'
    );
  }
};
