const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('witwas')
    .setDescription('Was geld wit')
    .addStringOption(option => 
      option.setName('klant')
        .setDescription('De naam van de klant')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('bedrag')
        .setDescription('Het bedrag dat je wilt witwassen')
        .setRequired(true)),
  
  async execute(interaction) {
    const { witwas, logs, leidingRol } = interaction.client.config;
    const standaardPercentage = witwas.percentage;
    
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen geld witwassen!', ephemeral: true });
    }

    const klant = interaction.options.getString('klant');
    const bedrag = interaction.options.getInteger('bedrag');
    
    if (bedrag <= 0) {
      return interaction.reply({ content: 'Je moet een positief bedrag invoeren!', ephemeral: true });
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
    
    const klantObj = klanten.find(k => k.naam.toLowerCase() === klant.toLowerCase());
    if (!klantObj) {
      return interaction.reply({ 
        content: `Klant "${klant}" bestaat niet! Gebruik /klantcreate om een nieuwe klant aan te maken.`, 
        ephemeral: true 
      });
    }
    
    if (klantObj.blacklisted) {
      return interaction.reply({ 
        content: `Klant "${klant}" staat op de blacklist en kan geen geld witwassen! Reden: ${klantObj.reden || 'Geen reden opgegeven'}`, 
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

    const nu = Date.now();
    const laatsteWitwas = witwasData.find(entry => entry.userId === interaction.user.id);
    
    if (laatsteWitwas) {
      const cooldownTijd = witwas.cooldown * 60 * 1000;
      const verstrekenTijd = nu - laatsteWitwas.timestamp;
      
      if (verstrekenTijd < cooldownTijd) {
        const resterendeTijd = Math.ceil((cooldownTijd - verstrekenTijd) / 60000);
        
        const aanvraagButton = new ButtonBuilder()
          .setCustomId('witwas_aanvraag')
          .setLabel('Aanvraag indienen voor nieuwe witwas')
          .setStyle(ButtonStyle.Success);
        
        const buttonRow = new ActionRowBuilder().addComponents(aanvraagButton);
        
        await interaction.reply({ 
          content: `Je moet nog ${resterendeTijd} minuten wachten voordat je weer geld kunt witwassen!\n\n` +
                   `Je kunt een aanvraag indienen om de cooldown te omzeilen. Dit zal een bericht sturen naar de leiding.`,
          components: [buttonRow], 
          ephemeral: true 
        });
        
        const buttonFilter = btn => btn.customId === 'witwas_aanvraag' && btn.user.id === interaction.user.id;
        const buttonCollector = interaction.channel.createMessageComponentCollector({ filter: buttonFilter, time: 30000, max: 1 });
        
        buttonCollector.on('collect', async button => {
          const modal = new ModalBuilder()
            .setCustomId('witwas_aanvraag_modal')
            .setTitle(`Aanvraag nieuwe witwas`);
          
          const redenInput = new TextInputBuilder()
            .setCustomId('reden_input')
            .setLabel(`Waarom wil je nu witwassen?`)
            .setPlaceholder('Geef een goede reden...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          
          const percentageInput = new TextInputBuilder()
            .setCustomId('percentage_input')
            .setLabel(`Verliespercentage (standaard: ${standaardPercentage}%)`)
            .setPlaceholder('Voer een getal in tussen 1 en 100')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(standaardPercentage.toString());
          
          const redenRow = new ActionRowBuilder().addComponents(redenInput);
          const percentageRow = new ActionRowBuilder().addComponents(percentageInput);
          modal.addComponents(redenRow, percentageRow);
          
          await button.showModal(modal);
          
          const modalFilter = m => m.customId === 'witwas_aanvraag_modal' && m.user.id === interaction.user.id;
          try {
            const modalSubmit = await interaction.awaitModalSubmit({ filter: modalFilter, time: 60000 });
            
            const reden = modalSubmit.fields.getTextInputValue('reden_input');
            const aangevraagdPercentage = parseInt(modalSubmit.fields.getTextInputValue('percentage_input'));
            
            if (isNaN(aangevraagdPercentage) || aangevraagdPercentage < 0 || aangevraagdPercentage > 100) {
              return modalSubmit.reply({ content: 'Je moet een getal tussen 0 en 100 invoeren voor het percentage!', ephemeral: true });
            }
            
            const verlies = Math.floor(bedrag * (aangevraagdPercentage / 100));
            const resultaat = bedrag - verlies;
            
            const aanvraagEmbed = new EmbedBuilder()
              .setColor(0xFF9900)
              .setTitle('🔄 Witwas Aanvraag')
              .setDescription(`<@${interaction.user.id}> wil een nieuwe witwas uitvoeren tijdens cooldown.`)
              .addFields(
                { name: 'Klant', value: klant, inline: true },
                { name: 'Bedrag', value: `€${bedrag}`, inline: true },
                { name: 'Cooldown', value: `${resterendeTijd} minuten resterend`, inline: true },
                { name: 'Aangevraagd percentage', value: `${aangevraagdPercentage}% (standaard: ${standaardPercentage}%)`, inline: true },
                { name: 'Resultaat (indien goedgekeurd)', value: `€${resultaat} (verlies: €${verlies})`, inline: true },
                { name: 'Reden', value: reden }
              )
              .setTimestamp();
            
            let aanvraagKanaal;
            if (logs && logs.aanvragen) {
              aanvraagKanaal = interaction.client.channels.cache.get(logs.aanvragen);
            }
            
            if (!aanvraagKanaal) {
              console.log("Aanvraagkanaal niet gevonden, gebruik algemeen logkanaal.");
              if (logs && logs.general) {
                aanvraagKanaal = interaction.client.channels.cache.get(logs.general);
              }
            }
            
            if (aanvraagKanaal) {
              const goedkeurenButton = new ButtonBuilder()
                .setCustomId(`witwas_goedkeuren_${interaction.user.id}_${bedrag}_${klant}_${aangevraagdPercentage}_${nu}`)
                .setLabel('Goedkeuren')
                .setStyle(ButtonStyle.Success);
              
              const afwijzenButton = new ButtonBuilder()
                .setCustomId(`witwas_afwijzen_${interaction.user.id}`)
                .setLabel('Afwijzen')
                .setStyle(ButtonStyle.Danger);
              
              const actionRow = new ActionRowBuilder().addComponents(goedkeurenButton, afwijzenButton);
              
              await aanvraagKanaal.send({ 
                content: `<@&${leidingRol}> Er is een nieuwe witwas aanvraag!`, 
                embeds: [aanvraagEmbed],
                components: [actionRow]
              });
              
              await modalSubmit.reply({ 
                content: `Je aanvraag is succesvol ingediend! De leiding is op de hoogte gebracht.`, 
                ephemeral: true 
              });
            } else {
              await modalSubmit.reply({ 
                content: `Er is een probleem met het aanvraagkanaal. Je aanvraag kon niet worden verzonden.`, 
                ephemeral: true 
              });
            }
          } catch (err) {
            if (err.code === 'INTERACTION_COLLECTOR_ERROR') {
              await interaction.followUp({ content: 'Je hebt geen reden ingevoerd binnen de tijdslimiet.', ephemeral: true });
            } else {
              console.error('Fout bij modal submit:', err);
            }
          }
        });
        
        buttonCollector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({ 
              content: 'Je hebt geen aanvraag ingediend binnen de tijdslimiet.', 
              components: [], 
              ephemeral: true 
            });
          }
        });
        
        return;
      }
    }
    
    const verliesPercentage = standaardPercentage;
    const verlies = Math.floor(bedrag * (verliesPercentage / 100));
    const resultaat = bedrag - verlies;
    
    const witwasButton = new ButtonBuilder()
      .setCustomId('witwas_standaard')
      .setLabel(`Witwassen met standaard percentage (${verliesPercentage}%)`)
      .setStyle(ButtonStyle.Primary);
    
    const aanpassenButton = new ButtonBuilder()
      .setCustomId('aanpassen_percentage')
      .setLabel('Aangepast percentage instellen')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder().addComponents(witwasButton, aanpassenButton);
    
    await interaction.reply({ 
      content: `Je wilt €${bedrag} witwassen voor ${klant}.\n` +
               `Huidig verliespercentage: ${verliesPercentage}%\n` +
               `Met dit percentage krijgt de klant €${resultaat} (verlies: €${verlies}).\n\n` +
               `Wil je witwassen met dit percentage of wil je een aangepast percentage instellen?`,
      components: [buttonRow],
      ephemeral: true
    });
    
    const buttonFilter = btn => (btn.customId === 'witwas_standaard' || btn.customId === 'aanpassen_percentage') && btn.user.id === interaction.user.id;
    const buttonCollector = interaction.channel.createMessageComponentCollector({ filter: buttonFilter, time: 30000, max: 1 });
    
    buttonCollector.on('collect', async button => {
      if (button.customId === 'witwas_standaard') {
        processWitwas(button, bedrag, klant, verliesPercentage);
      } else if (button.customId === 'aanpassen_percentage') {
        const modal = new ModalBuilder()
          .setCustomId('percentage_modal')
          .setTitle(`Aangepast witwaspercentage`);
        
        const percentageInput = new TextInputBuilder()
          .setCustomId('percentage_input')
          .setLabel(`Verliespercentage (momenteel ${verliesPercentage}%)`)
          .setPlaceholder('Voer een getal in tussen 1 en 100')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(verliesPercentage.toString());
        
        const modalRow = new ActionRowBuilder().addComponents(percentageInput);
        modal.addComponents(modalRow);
        
        await button.showModal(modal);
        
        const modalFilter = m => m.customId === 'percentage_modal' && m.user.id === interaction.user.id;
        try {
          const modalSubmit = await interaction.awaitModalSubmit({ filter: modalFilter, time: 30000 });
          
          const newPercentage = parseInt(modalSubmit.fields.getTextInputValue('percentage_input'));
          if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
            return modalSubmit.reply({ content: 'Je moet een getal tussen 0 en 100 invoeren!', ephemeral: true });
          }
          
          processWitwas(modalSubmit, bedrag, klant, newPercentage);
        } catch (err) {
          if (err.code === 'INTERACTION_COLLECTOR_ERROR') {
            await interaction.followUp({ content: 'Je hebt geen nieuw percentage ingevoerd binnen de tijdslimiet.', ephemeral: true });
          } else {
            console.error('Fout bij modal submit:', err);
          }
        }
      }
    });
    
    buttonCollector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ 
          content: 'Je hebt geen keuze gemaakt binnen de tijdslimiet.', 
          components: [], 
          ephemeral: true 
        });
      }
    });
    
    async function processWitwas(i, bedrag, klant, verliesPercentage) {
      const verlies = Math.floor(bedrag * (verliesPercentage / 100));
      const resultaat = bedrag - verlies;
      
      const witwasEntry = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        klant: klant,
        bedrag: bedrag,
        verliesPercentage: verliesPercentage,
        resultaat: resultaat,
        verlies: verlies,
        timestamp: nu,
        date: new Date().toLocaleString()
      };
      
      const bestaandeIndex = witwasData.findIndex(entry => entry.userId === interaction.user.id);
      if (bestaandeIndex !== -1) {
        witwasData[bestaandeIndex] = witwasEntry;
      } else {
        witwasData.push(witwasEntry);
      }
      
      fs.writeFileSync(path.join(__dirname, '../witwas.json'), JSON.stringify(witwasData, null, 2));
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('💰 Geld Witwassen')
        .setDescription(`Je hebt succesvol €${bedrag} witgewassen voor ${klant}.`)
        .addFields(
          { name: 'Klant', value: klant, inline: true },
          { name: 'Zwart geld', value: `€${bedrag}`, inline: true },
          { name: 'Verliespercentage', value: `${verliesPercentage}%`, inline: true },
          { name: 'Wit geld', value: `€${resultaat}`, inline: true },
          { name: 'Verlies', value: `€${verlies}`, inline: true }
        )
        .setTimestamp();
      
      await i.update({ content: null, embeds: [embed], components: [], ephemeral: true });
      
      await interaction.client.stuurLog(
        `👤 Dealer: <@${interaction.user.id}>\n` +
        `👥 Klant: ${klant}\n` +
        `💵 Zwart geld: €${bedrag}\n` +
        `📊 Verliespercentage: ${verliesPercentage}%\n` +
        `💰 Wit geld: €${resultaat}\n` +
        `📉 Verlies: €${verlies}`,
        'witwas'
      );
    }
  }
};
