const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wapenlijst')
    .setDescription('Beheer je wapenlijst')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Voeg een wapen toe aan je wapenlijst')
        .addStringOption(option =>
          option.setName('serienummer')
            .setDescription('Het serienummer van het wapen')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('notitie')
            .setDescription('Optionele notitie over het wapen')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Verwijder een wapen van je wapenlijst'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Bekijk een wapenlijst (alleen voor leiding)')
        .addUserOption(option =>
          option.setName('lid')
            .setDescription('Het ganglid waarvan je de wapenlijst wilt bekijken')
            .setRequired(true))),
  
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
      return interaction.reply({ content: 'Je staat op de blacklist en kunt geen wapenlijst beheren!', ephemeral: true });
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'add') {
      await handleAddWeapon(interaction);
    } else if (subcommand === 'delete') {
      await handleDeleteWeapon(interaction);
    } else if (subcommand === 'check') {
      await handleCheckWeapons(interaction);
    }
  }
};

async function handleAddWeapon(interaction) {
  try {
    const { wapens } = interaction.client.config;
    const serienummer = interaction.options.getString('serienummer');
    const notitie = interaction.options.getString('notitie') || 'Geen notitie';
    
    let wapenlijsten = {};
    try {
      const data = fs.readFileSync(path.join(__dirname, '../wapenlijsten.json'), 'utf8');
      wapenlijsten = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van wapenlijsten.json:', err);
      }
    }
    
    if (!wapenlijsten[interaction.user.id]) {
      wapenlijsten[interaction.user.id] = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        wapens: []
      };
    }
    
    const bestaandWapen = wapenlijsten[interaction.user.id].wapens.find(w => w.serienummer === serienummer);
    if (bestaandWapen) {
      return interaction.reply({ 
        content: `Je hebt al een wapen met serienummer ${serienummer} in je wapenlijst!`, 
        ephemeral: true 
      });
    }
    
    const wapenTypes = wapens && wapens.types ? wapens.types : ["Pistool", "Shotgun", "SMG", "Assault Rifle", "Sniper Rifle"];
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('wapen_select')
      .setPlaceholder('Selecteer een wapentype')
      .addOptions(wapenTypes.map(type => ({
        label: type,
        value: type,
        description: `Voeg een ${type} toe aan je wapenlijst`
      })));
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ 
      content: `Selecteer het type wapen dat je wilt toevoegen:`,
      components: [row],
      ephemeral: true
    });
    
    const filter = i => i.customId === 'wapen_select' && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
    
    collector.on('collect', async i => {
      try {
        await i.deferUpdate();
        
        const wapenType = i.values[0];
        
        const nieuwWapen = {
          naam: wapenType,
          serienummer: serienummer,
          notitie: notitie,
          toegevoegd: new Date().toLocaleString()
        };
        
        wapenlijsten[interaction.user.id].wapens.push(nieuwWapen);
        fs.writeFileSync(path.join(__dirname, '../wapenlijsten.json'), JSON.stringify(wapenlijsten, null, 2));
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🔫 Wapen Toegevoegd')
          .setDescription(`Je hebt succesvol een wapen toegevoegd aan je wapenlijst.`)
          .addFields(
            { name: 'Wapen', value: wapenType, inline: true },
            { name: 'Serienummer', value: serienummer, inline: true },
            { name: 'Notitie', value: notitie, inline: true },
            { name: 'Totaal wapens', value: `${wapenlijsten[interaction.user.id].wapens.length}`, inline: true }
          )
          .setTimestamp();
        
        await i.editReply({ content: null, embeds: [embed], components: [] });
        
        await interaction.client.stuurLog(
          `👤 Gebruiker: <@${interaction.user.id}>\n` +
          `🔫 Wapen toegevoegd: ${wapenType}\n` +
          `🔢 Serienummer: ${serienummer}\n` +
          `📝 Notitie: ${notitie}`,
          'wapens'
        );
      } catch (error) {
        console.error('Fout bij het verwerken van wapenselectie:', error);
        try {
          await interaction.followUp({ 
            content: 'Er is een fout opgetreden bij het toevoegen van het wapen.', 
            ephemeral: true 
          });
        } catch (followUpError) {
          console.error('Fout bij followUp:', followUpError);
        }
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        try {
          interaction.editReply({ 
            content: 'Je hebt geen wapentype geselecteerd binnen de tijdslimiet.', 
            components: [], 
            ephemeral: true 
          });
        } catch (error) {
          console.error('Fout bij het updaten van timeout bericht:', error);
        }
      }
    });
  } catch (error) {
    console.error('Fout bij het uitvoeren van wapenlijst add:', error);
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

async function handleDeleteWeapon(interaction) {
  try {
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
    
    const wapens = wapenlijsten[interaction.user.id].wapens;
    
    const rows = [];
    const maxButtonsPerRow = 5;
    const maxRows = 5; // Discord staat maximaal 5 rijen toe
    const maxWapens = maxButtonsPerRow * maxRows;
    
    for (let i = 0; i < Math.min(Math.ceil(wapens.length / maxButtonsPerRow), maxRows); i++) {
      const row = new ActionRowBuilder();
      
      for (let j = 0; j < maxButtonsPerRow; j++) {
        const index = i * maxButtonsPerRow + j;
        if (index < wapens.length && index < maxWapens) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`delete_wapen_${index}`)
              .setLabel(`#${index + 1}: ${wapens[index].naam}`)
              .setStyle(ButtonStyle.Danger)
          );
        }
      }
      
      if (row.components.length > 0) {
        rows.push(row);
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔫 Verwijder Wapen')
      .setDescription(`Selecteer het wapen dat je wilt verwijderen uit je wapenlijst:`)
      .setTimestamp();
    
    await interaction.reply({ 
      embeds: [embed],
      components: rows,
      ephemeral: true
    });
    
    const filter = i => i.customId.startsWith('delete_wapen_') && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
    
    collector.on('collect', async i => {
      try {
        await i.deferUpdate();
        
        const index = parseInt(i.customId.split('_')[2]);
        
        if (index < 0 || index >= wapens.length) {
          return i.editReply({ 
            content: 'Ongeldig wapen geselecteerd!', 
            embeds: [], 
            components: [], 
            ephemeral: true 
          });
        }
        
        const verwijderdWapen = wapens[index];
        wapenlijsten[interaction.user.id].wapens.splice(index, 1);
        fs.writeFileSync(path.join(__dirname, '../wapenlijsten.json'), JSON.stringify(wapenlijsten, null, 2));
        
        const resultEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('🔫 Wapen Verwijderd')
          .setDescription(`Je hebt succesvol een wapen verwijderd uit je wapenlijst.`)
          .addFields(
            { name: 'Wapen', value: verwijderdWapen.naam, inline: true },
            { name: 'Serienummer', value: verwijderdWapen.serienummer, inline: true },
            { name: 'Notitie', value: verwijderdWapen.notitie, inline: true },
            { name: 'Totaal wapens', value: `${wapenlijsten[interaction.user.id].wapens.length}`, inline: true }
          )
          .setTimestamp();
        
        await i.editReply({ embeds: [resultEmbed], components: [] });
        
        await interaction.client.stuurLog(
          `👤 Gebruiker: <@${interaction.user.id}>\n` +
          `🔫 Wapen verwijderd: ${verwijderdWapen.naam}\n` +
          `🔢 Serienummer: ${verwijderdWapen.serienummer}`,
          'wapens'
        );
      } catch (error) {
        console.error('Fout bij het verwijderen van wapen:', error);
        try {
          await interaction.followUp({ 
            content: 'Er is een fout opgetreden bij het verwijderen van het wapen.', 
            ephemeral: true 
          });
        } catch (followUpError) {
          console.error('Fout bij followUp:', followUpError);
        }
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        try {
          interaction.editReply({ 
            content: 'Je hebt geen wapen geselecteerd binnen de tijdslimiet.', 
            embeds: [], 
            components: [], 
            ephemeral: true 
          });
        } catch (error) {
          console.error('Fout bij het updaten van timeout bericht:', error);
        }
      }
    });
  } catch (error) {
    console.error('Fout bij het uitvoeren van wapenlijst delete:', error);
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

async function handleCheckWeapons(interaction) {
  try {
    const { gangRol } = interaction.client.config;
    
    const hasGangRole = interaction.member.roles.cache.has(gangRol);
    if (!hasGangRole) {
      return interaction.reply({ 
        content: 'Je hebt geen toestemming om wapenlijsten van anderen te bekijken!', 
        ephemeral: true 
      });
    }
    
    const lid = interaction.options.getUser('lid');
    
    let wapenlijsten = {};
    try {
      const data = fs.readFileSync(path.join(__dirname, '../wapenlijsten.json'), 'utf8');
      wapenlijsten = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Fout bij het lezen van wapenlijsten.json:', err);
      }
    }
    
    if (!wapenlijsten[lid.id] || !wapenlijsten[lid.id].wapens.length) {
      return interaction.reply({ 
        content: `${lid.tag} heeft geen wapens in zijn wapenlijst!`, 
        ephemeral: true 
      });
    }
    
    const wapens = wapenlijsten[lid.id].wapens;
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`🔫 Wapenlijst van ${lid.tag}`)
      .setDescription(`${lid.tag} heeft ${wapens.length} wapen(s) in zijn wapenlijst.`)
      .setTimestamp();
    
    wapens.forEach((wapen, index) => {
      embed.addFields({
        name: `Wapen #${index + 1}: ${wapen.naam}`,
        value: `Serienummer: ${wapen.serienummer}\nNotitie: ${wapen.notitie}\nToegevoegd: ${wapen.toegevoegd}`,
        inline: false
      });
    });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    await interaction.client.stuurLog(
      `👤 Leiding: <@${interaction.user.id}>\n` +
      `👥 Heeft wapenlijst bekeken van: <@${lid.id}>\n` +
      `🔫 Aantal wapens: ${wapens.length}`,
      'wapens'
    );
  } catch (error) {
    console.error('Fout bij het uitvoeren van wapenlijst check:', error);
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
