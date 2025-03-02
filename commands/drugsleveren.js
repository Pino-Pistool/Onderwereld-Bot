const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drugsleveren')
    .setDescription('Lever drugs aan een klant')
    .addStringOption(option => 
      option.setName('klant')
        .setDescription('De naam van de klant')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('hoeveelheid')
        .setDescription('De hoeveelheid drugs die je wilt leveren')
        .setRequired(true)),
  
  async execute(interaction) {
    const { drugs } = interaction.client.config;
    
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen drugs leveren!', ephemeral: true });
    }

    const klant = interaction.options.getString('klant');
    const hoeveelheid = interaction.options.getInteger('hoeveelheid');
    
    if (hoeveelheid <= 0) {
      return interaction.reply({ content: 'Je moet een positieve hoeveelheid invoeren!', ephemeral: true });
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
        content: `Klant "${klant}" staat op de blacklist en kan geen drugs ontvangen! Reden: ${klantObj.reden || 'Geen reden opgegeven'}`, 
        ephemeral: true 
      });
    }
    
    const drugsRates = {};
    drugs.soorten.forEach(soort => {
      drugsRates[soort] = drugs.standaardHoeveelheid;
    });
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('drugssoort_select')
      .setPlaceholder('Selecteer een drugssoort')
      .addOptions(drugs.soorten.map(soort => {
        const rate = drugsRates[soort] || drugs.standaardHoeveelheid;
        return {
          label: soort,
          value: soort,
          description: `Verhouding 1:${rate} - Lever ${soort} aan ${klant}`
        };
      }));
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ 
      content: `Selecteer de drugssoort die je wilt leveren aan ${klant}:`,
      components: [row],
      ephemeral: true
    });
    
    const filter = i => i.customId === 'drugssoort_select' && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
    
    collector.on('collect', async i => {
      const drugssoort = i.values[0];
      const rate = drugsRates[drugssoort] || drugs.standaardHoeveelheid;
      const zakken = Math.ceil(hoeveelheid / rate);
      
      const leverenButton = new ButtonBuilder()
        .setCustomId('leveren_standaard')
        .setLabel('Leveren met standaard verhouding')
        .setStyle(ButtonStyle.Primary);
      
      const aanpassenButton = new ButtonBuilder()
        .setCustomId('aanpassen_rate')
        .setLabel('Aangepaste verhouding instellen')
        .setStyle(ButtonStyle.Secondary);
      
      const buttonRow = new ActionRowBuilder().addComponents(leverenButton, aanpassenButton);
      
      await i.update({ 
        content: `Je hebt ${drugssoort} geselecteerd voor ${klant}.\n` +
                 `Huidige verhouding: 1:${rate} (1 zak per ${rate} stuks)\n` +
                 `Met deze verhouding krijgt de klant ${zakken} zak(ken) voor ${hoeveelheid} stuks.\n\n` +
                 `Wil je leveren met deze verhouding of wil je een aangepaste verhouding instellen?`,
        components: [buttonRow],
        ephemeral: true
      });
      
      const buttonFilter = btn => (btn.customId === 'leveren_standaard' || btn.customId === 'aanpassen_rate') && btn.user.id === interaction.user.id;
      const buttonCollector = interaction.channel.createMessageComponentCollector({ filter: buttonFilter, time: 30000, max: 1 });
      
      buttonCollector.on('collect', async button => {
        if (button.customId === 'leveren_standaard') {
          processDrugsDeal(button, drugssoort, hoeveelheid, klant, rate, zakken);
        } else if (button.customId === 'aanpassen_rate') {
          const modal = new ModalBuilder()
            .setCustomId('rate_modal')
            .setTitle(`Aangepaste verhouding voor ${drugssoort}`);
          
          const rateInput = new TextInputBuilder()
            .setCustomId('rate_input')
            .setLabel(`Verhouding (momenteel 1:${rate})`)
            .setPlaceholder('Voer een getal in (bijv. 3 voor 1:3)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(rate.toString());
          
          const modalRow = new ActionRowBuilder().addComponents(rateInput);
          modal.addComponents(modalRow);
          
          await button.showModal(modal);
          
          const modalFilter = m => m.customId === 'rate_modal' && m.user.id === interaction.user.id;
          try {
            const modalSubmit = await interaction.awaitModalSubmit({ filter: modalFilter, time: 30000 });
            
            const newRate = parseInt(modalSubmit.fields.getTextInputValue('rate_input'));
            if (isNaN(newRate) || newRate <= 0) {
              return modalSubmit.reply({ content: 'Je moet een positief getal invoeren!', ephemeral: true });
            }
            
            const newZakken = Math.ceil(hoeveelheid / newRate);
            
            processDrugsDeal(modalSubmit, drugssoort, hoeveelheid, klant, newRate, newZakken);
          } catch (err) {
            if (err.code === 'INTERACTION_COLLECTOR_ERROR') {
              await interaction.followUp({ content: 'Je hebt geen nieuwe verhouding ingevoerd binnen de tijdslimiet.', ephemeral: true });
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
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ 
          content: 'Je hebt geen drugssoort geselecteerd binnen de tijdslimiet.', 
          components: [], 
          ephemeral: true 
        });
      }
    });
    
    async function processDrugsDeal(i, drugssoort, hoeveelheid, klant, rate, zakken) {
      let drugsdeals = [];
      try {
        const data = fs.readFileSync(path.join(__dirname, '../drugsdeals.json'), 'utf8');
        drugsdeals = JSON.parse(data);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Fout bij het lezen van drugsdeals.json:', err);
        }
      }
      
      const deal = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        klant: klant,
        drugssoort: drugssoort,
        hoeveelheid: hoeveelheid,
        rate: rate,
        zakken: zakken,
        timestamp: Date.now(),
        date: new Date().toLocaleString()
      };
      
      drugsdeals.push(deal);
      fs.writeFileSync(path.join(__dirname, '../drugsdeals.json'), JSON.stringify(drugsdeals, null, 2));
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🌿 Drugs Levering')
        .setDescription(`Je hebt succesvol drugs geleverd aan ${klant}.`)
        .addFields(
          { name: 'Drugssoort', value: drugssoort, inline: true },
          { name: 'Hoeveelheid', value: `${hoeveelheid} stuks`, inline: true },
          { name: 'Verhouding', value: `1:${rate}`, inline: true },
          { name: 'Zakken', value: `${zakken} zak(ken)`, inline: true },
          { name: 'Klant', value: klant, inline: true }
        )
        .setTimestamp();
      
      await i.update({ content: null, embeds: [embed], components: [], ephemeral: true });
      
      await interaction.client.stuurLog(
        `👤 Dealer: <@${interaction.user.id}>\n` +
        `👥 Klant: ${klant}\n` +
        `🔍 Drugssoort: ${drugssoort}\n` +
        `📊 Hoeveelheid: ${hoeveelheid} stuks\n` +
        `📏 Verhouding: 1:${rate}\n` +
        `🧪 Zakken: ${zakken} zak(ken)`,
        'drugs'
      );
    }
  }
};
