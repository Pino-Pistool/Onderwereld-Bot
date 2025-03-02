const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('witwascheck')
    .setDescription('Bekijk witwashistorie van een klant')
    .addStringOption(option => 
      option.setName('klant')
        .setDescription('De naam van de klant')
        .setRequired(true)),
  
  async execute(interaction) {
    const { witwas } = interaction.client.config;
    
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen witwashistorie bekijken!', ephemeral: true });
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
    
    let witwasData = [];
    try {
      const data = fs.readFileSync(path.join(__dirname, '../witwas.json'), 'utf8');
      witwasData = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van witwas.json:', err);
      }
    }
    
    const klantWitwas = witwasData.filter(transaction => 
      transaction && 
      transaction.klant && 
      transaction.klant.toLowerCase() === klantNaam.toLowerCase()
    );
    
    if (klantWitwas.length === 0) {
      return interaction.reply({ 
        content: `Klant "${klantNaam}" heeft nog geen witwastransacties gehad.`, 
        ephemeral: true 
      });
    }
    
    const sortedWitwas = [...klantWitwas].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    let totalBedrag = 0;
    let totalResultaat = 0;
    let totalVerlies = 0;
    
    sortedWitwas.forEach(transaction => {
      if (transaction.bedrag) totalBedrag += transaction.bedrag;
      if (transaction.resultaat) totalResultaat += transaction.resultaat;
      if (transaction.verlies) totalVerlies += transaction.verlies;
    });
    
    const mainEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`💰 Witwashistorie voor ${klantNaam}`)
      .setDescription(`${klantNaam} heeft in totaal ${klantWitwas.length} witwastransacties gehad.`)
      .addFields(
        { name: 'Telefoonnummer', value: klantObj.telefoonnummer || 'Onbekend', inline: true },
        { name: 'Status', value: klantObj.blacklisted ? `🚫 Blacklisted (${klantObj.reden || 'Geen reden'})` : '✅ Actief', inline: true },
        { name: 'Aangemaakt door', value: klantObj.aangemaakt_door || 'Onbekend', inline: true },
        { name: 'Aangemaakt op', value: klantObj.aangemaakt_op || 'Onbekend', inline: true },
        { name: 'Totaal zwart geld', value: `€${totalBedrag}`, inline: true },
        { name: 'Totaal wit geld', value: `€${totalResultaat}`, inline: true },
        { name: 'Totaal verlies', value: `€${totalVerlies}`, inline: true },
        { name: 'Standaard witwaspercentage', value: `${witwas.percentage}%`, inline: true },
        { name: 'Witwas cooldown', value: `${witwas.cooldown} minuten`, inline: true }
      )
      .setTimestamp();
    
    const transactionEmbeds = [];
    
    for (let i = 0; i < Math.min(sortedWitwas.length, 25); i++) {
      const transaction = sortedWitwas[i];
      
      const transactionEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`💰 Witwastransactie #${i + 1} voor ${klantNaam}`)
        .setTimestamp();
      
      const fields = [];
      
      if (transaction.bedrag !== undefined) {
        fields.push({ name: 'Zwart geld', value: `€${transaction.bedrag}`, inline: true });
      }
      
      if (transaction.verliesPercentage !== undefined) {
        fields.push({ name: 'Verliespercentage', value: `${transaction.verliesPercentage}%`, inline: true });
      }
      
      if (transaction.resultaat !== undefined) {
        fields.push({ name: 'Wit geld', value: `€${transaction.resultaat}`, inline: true });
      }
      
      if (transaction.verlies !== undefined) {
        fields.push({ name: 'Verlies', value: `€${transaction.verlies}`, inline: true });
      }
      
      if (transaction.userId) {
        fields.push({ name: 'Dealer', value: `<@${transaction.userId}> (${transaction.username || 'Onbekend'})`, inline: true });
      }
      
      if (transaction.date || transaction.timestamp) {
        fields.push({ name: 'Datum', value: transaction.date || new Date(transaction.timestamp).toLocaleString(), inline: true });
      }
      
      if (transaction.goedgekeurdDoor) {
        fields.push({ name: 'Goedgekeurd door', value: transaction.goedgekeurdDoorId ? `<@${transaction.goedgekeurdDoorId}> (${transaction.goedgekeurdDoor})` : transaction.goedgekeurdDoor, inline: true });
      }
      
      transactionEmbed.addFields(fields);
      transactionEmbeds.push(transactionEmbed);
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
    
    const maxTransactionsToShow = Math.min(sortedWitwas.length, 24);
    const buttonsPerRow = 5;
    const numRows = Math.ceil(maxTransactionsToShow / buttonsPerRow);
    
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      const row = new ActionRowBuilder();
      
      for (let buttonIndex = 0; buttonIndex < buttonsPerRow; buttonIndex++) {
        const transactionIndex = rowIndex * buttonsPerRow + buttonIndex;
        
        if (transactionIndex < maxTransactionsToShow) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`transaction_${transactionIndex}`)
              .setLabel(`#${transactionIndex + 1}`)
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
    
    const filter = i => (i.customId === 'overview' || i.customId.startsWith('transaction_')) && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });
    
    collector.on('collect', async i => {
      try {
        if (i.customId === 'overview') {
          await i.deferUpdate();
          await i.editReply({ embeds: [mainEmbed], components: rows });
        } else if (i.customId.startsWith('transaction_')) {
          const index = parseInt(i.customId.split('_')[1]);
          if (index >= 0 && index < transactionEmbeds.length) {
            await i.deferUpdate();
            await i.editReply({ embeds: [transactionEmbeds[index]], components: rows });
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
      `👥 Heeft witwashistorie bekeken van klant: ${klantNaam}\n` +
      `💰 Totaal witgewassen: €${totalBedrag}\n` +
      `💸 Totaal resultaat: €${totalResultaat}`,
      'witwas'
    );
  }
};
