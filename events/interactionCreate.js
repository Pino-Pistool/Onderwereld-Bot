const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    try {
      if (interaction.isCommand()) {
        const commando = client.commands.get(interaction.commandName);
        if (!commando) {
          console.error(`Commando niet gevonden: ${interaction.commandName}`);
          return;
        }

        try {
          await commando.execute(interaction);
        } catch (error) {
          console.error(`Fout bij het uitvoeren van commando ${interaction.commandName}:`, error);
          await client.stuurLog(`Fout bij het uitvoeren van commando ${interaction.commandName}: ${error.message}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Er is een fout opgetreden bij het uitvoeren van dit commando!', ephemeral: true });
          }
        }
      }
      
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'wapen_aanvraag_select') {
          const geselecteerdWapen = interaction.values[0];
          
          const modal = new ModalBuilder()
            .setCustomId(`wapen_reden_modal_${geselecteerdWapen}`)
            .setTitle('Reden voor wapenaanvraag');
          
          const redenInput = new TextInputBuilder()
            .setCustomId('reden_input')
            .setLabel('Waarom heb je dit wapen nodig?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Geef een duidelijke reden voor je aanvraag...')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);
          
          const firstActionRow = new ActionRowBuilder().addComponents(redenInput);
          modal.addComponents(firstActionRow);
          
          await interaction.showModal(modal);
        }

        if (interaction.customId === 'wapen_select') {
          const wapenType = interaction.values[0];
          const serienummer = interaction.message.content.match(/serienummer: (\S+)/i)?.[1];
          const notitie = interaction.message.content.match(/notitie: (.+)/i)?.[1] || 'Geen notitie';
          
          if (!serienummer) {
            return interaction.update({ 
              content: 'Kon het serienummer niet vinden. Probeer opnieuw.', 
              components: [], 
              ephemeral: true 
            });
          }
          
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
          
          await interaction.update({ content: null, embeds: [embed], components: [] });
          
          await interaction.client.stuurLog(
            `👤 Gebruiker: <@${interaction.user.id}>\n` +
            `🔫 Wapen toegevoegd: ${wapenType}\n` +
            `🔢 Serienummer: ${serienummer}\n` +
            `📝 Notitie: ${notitie}`,
            'wapens'
          );
        }
      }
      
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('wapen_reden_modal_')) {
          const wapenType = interaction.customId.replace('wapen_reden_modal_', '');
          const reden = interaction.fields.getTextInputValue('reden_input');
          const datum = interaction.user.lastSlashCommand?.options.getString('datum') || 'Niet gespecificeerd';
          
          const requestEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('Wapen Aanvraag')
            .setDescription(`Een nieuw wapen is aangevraagd door ${interaction.user}`)
            .addFields(
              { name: 'Wapen', value: wapenType, inline: true },
              { name: 'Datum Nodig', value: datum, inline: true },
              { name: 'Reden', value: reden },
              { name: 'Aanvrager', value: `<@${interaction.user.id}>` }
            )
            .setTimestamp();
          
          const buttons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`approve_wapen_${interaction.user.id}_${Date.now()}`)
                .setLabel('Goedkeuren')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`deny_wapen_${interaction.user.id}_${Date.now()}`)
                .setLabel('Afwijzen')
                .setStyle(ButtonStyle.Danger)
            );
          
          const aanvraagKanaal = client.channels.cache.get(client.config.logs.aanvragen);
          if (!aanvraagKanaal) {
            return interaction.reply({ 
              content: 'Kon het aanvraag kanaal niet vinden. Contacteer een administrator.', 
              ephemeral: true 
            });
          }
          
          await aanvraagKanaal.send({ embeds: [requestEmbed], components: [buttons] });
          
          await client.stuurLog(
            `Nieuwe wapenaanvraag van ${interaction.user.tag} (${interaction.user.id}):\n` +
            `Wapen: ${wapenType}\n` +
            `Datum: ${datum}\n` +
            `Reden: ${reden}`,
            'wapens'
          );
          
          await interaction.reply({ 
            content: `Je aanvraag voor ${wapenType} is ingediend en wordt beoordeeld door de gang leiding.`, 
            ephemeral: true 
          });
        }
        
        if (interaction.customId.startsWith('approve_modal_')) {
          const [_, __, userId, timestamp] = interaction.customId.split('_');
          
          const location = interaction.fields.getTextInputValue('location');
          const datetime = interaction.fields.getTextInputValue('datetime');
          const price = interaction.fields.getTextInputValue('price');
          
          try {
            const targetUser = await client.users.fetch(userId);
            
            const approvalEmbed = new EmbedBuilder()
              .setColor('#00ff00')
              .setTitle('Wapen Aanvraag Goedgekeurd')
              .setDescription(`Je wapen aanvraag is goedgekeurd door ${interaction.user.tag}`)
              .addFields(
                { name: 'Locatie', value: location, inline: true },
                { name: 'Datum & Tijd', value: datetime, inline: true },
                { name: 'Prijs', value: price, inline: true }
              )
              .setTimestamp();
              
            await targetUser.send({ embeds: [approvalEmbed] }).catch(() => {
              interaction.followUp({ 
                content: 'Kon geen DM sturen naar de gebruiker. Mogelijk heeft de gebruiker DMs uitgeschakeld.', 
                ephemeral: true 
              });
            });
            
            const message = interaction.message;
            const originalEmbed = message.embeds[0];
            const wapenType = originalEmbed.fields.find(field => field.name === 'Wapen')?.value || 'Onbekend wapen';
            
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
              .setColor('#00ff00')
              .addFields(
                { name: 'Status', value: 'Goedgekeurd' },
                { name: 'Goedgekeurd door', value: interaction.user.tag },
                { name: 'Locatie', value: location },
                { name: 'Datum & Tijd', value: datetime },
                { name: 'Prijs', value: price }
              );
            
            const leverButton = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`lever_wapen_${userId}_${wapenType}_${Date.now()}`)
                  .setLabel('Geleverd')
                  .setStyle(ButtonStyle.Primary)
              );
              
            await message.edit({ embeds: [updatedEmbed], components: [leverButton] });
            
            await client.stuurLog(
              `Wapen aanvraag van <@${userId}> is goedgekeurd door ${interaction.user.tag}\n` +
              `Wapen: ${wapenType}\n` +
              `Locatie: ${location}\n` +
              `Datum & Tijd: ${datetime}\n` +
              `Prijs: ${price}`,
              'wapens'
            );
            
            await interaction.reply({ content: 'Wapen aanvraag goedgekeurd en gebruiker geïnformeerd.', ephemeral: true });
          } catch (error) {
            console.error('Fout bij goedkeuren wapenaanvraag:', error);
            await interaction.reply({ content: 'Er is een fout opgetreden bij het goedkeuren van de wapenaanvraag.', ephemeral: true });
          }
        }
        
        if (interaction.customId.startsWith('deny_modal_')) {
          const [_, __, userId, timestamp] = interaction.customId.split('_');
          
          const reason = interaction.fields.getTextInputValue('reason');
          
          try {
            const targetUser = await client.users.fetch(userId);
            
            const denialEmbed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Wapen Aanvraag Afgewezen')
              .setDescription(`Je wapen aanvraag is afgewezen door ${interaction.user.tag}`)
              .addFields(
                { name: 'Reden', value: reason }
              )
              .setTimestamp();
              
            await targetUser.send({ embeds: [denialEmbed] }).catch(() => {
              interaction.followUp({ 
                content: 'Kon geen DM sturen naar de gebruiker. Mogelijk heeft de gebruiker DMs uitgeschakeld.', 
                ephemeral: true 
              });
            });
            
            const message = interaction.message;
            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
              .setColor('#ff0000')
              .addFields(
                { name: 'Status', value: 'Afgewezen' },
                { name: 'Afgewezen door', value: interaction.user.tag },
                { name: 'Reden', value: reason }
              );
              
            await message.edit({ embeds: [updatedEmbed], components: [] });
            
            await client.stuurLog(
              `Wapen aanvraag van <@${userId}> is afgewezen door ${interaction.user.tag}\n` +
              `Reden: ${reason}`,
              'wapens'
            );
            
            await interaction.reply({ content: 'Wapen aanvraag afgewezen en gebruiker geïnformeerd.', ephemeral: true });
          } catch (error) {
            console.error('Fout bij afwijzen wapenaanvraag:', error);
            await interaction.reply({ content: 'Er is een fout opgetreden bij het afwijzen van de wapenaanvraag.', ephemeral: true });
          }
        }
      }
      
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('approve_wapen_')) {
          if (!interaction.member.roles.cache.has(client.config.leidingRol)) {
            return interaction.reply({
              content: 'Alleen gang leiding kan deze actie uitvoeren.',
              ephemeral: true
            });
          }
          
          const [_, __, userId, timestamp] = interaction.customId.split('_');
          
          const modal = new ModalBuilder()
            .setCustomId(`approve_modal_${userId}_${timestamp}`)
            .setTitle('Wapen Goedkeuren');
            
          const locationInput = new TextInputBuilder()
            .setCustomId('location')
            .setLabel('Locatie voor overdracht')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
          const dateTimeInput = new TextInputBuilder()
            .setCustomId('datetime')
            .setLabel('Datum en tijd voor overdracht')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
          const priceInput = new TextInputBuilder()
            .setCustomId('price')
            .setLabel('Prijs')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
          const firstRow = new ActionRowBuilder().addComponents(locationInput);
          const secondRow = new ActionRowBuilder().addComponents(dateTimeInput);
          const thirdRow = new ActionRowBuilder().addComponents(priceInput);
          
          modal.addComponents(firstRow, secondRow, thirdRow);
          
          await interaction.showModal(modal);
        }
        
        if (interaction.customId.startsWith('deny_wapen_')) {
          if (!interaction.member.roles.cache.has(client.config.leidingRol)) {
            return interaction.reply({
              content: 'Alleen gang leiding kan deze actie uitvoeren.',
              ephemeral: true
            });
          }
          
          const [_, __, userId, timestamp] = interaction.customId.split('_');
          
          const modal = new ModalBuilder()
            .setCustomId(`deny_modal_${userId}_${timestamp}`)
            .setTitle('Wapen Afwijzen');
            
          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reden voor afwijzing')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
            
          const firstRow = new ActionRowBuilder().addComponents(reasonInput);
          
          modal.addComponents(firstRow);
          
          await interaction.showModal(modal);
        }
        
        if (interaction.customId.startsWith('lever_wapen_')) {
          if (!interaction.member.roles.cache.has(client.config.leidingRol)) {
            return interaction.reply({
              content: 'Alleen gang leiding kan deze actie uitvoeren.',
              ephemeral: true
            });
          }
          
          const [_, __, userId, wapenType, timestamp] = interaction.customId.split('_');
          
          try {
            const targetUser = await client.users.fetch(userId);
            
            const serienummer = `WPN-${Math.floor(100000 + Math.random() * 900000)}`;
            
            let wapenlijsten = {};
            try {
              const data = fs.readFileSync(path.join(__dirname, '../wapenlijsten.json'), 'utf8');
              wapenlijsten = JSON.parse(data);
            } catch (err) {
              if (err.code !== 'ENOENT') {
                console.error('Fout bij het lezen van wapenlijsten.json:', err);
              }
            }
            
            if (!wapenlijsten[userId]) {
              wapenlijsten[userId] = {
                userId: userId,
                username: targetUser.tag,
                wapens: []
              };
            }
            
            const nieuwWapen = {
              naam: wapenType,
              serienummer: serienummer,
              notitie: `Geleverd door ${interaction.user.tag} via wapenaanvraag`,
              toegevoegd: new Date().toLocaleString()
            };
            
            wapenlijsten[userId].wapens.push(nieuwWapen);
            fs.writeFileSync(path.join(__dirname, '../wapenlijsten.json'), JSON.stringify(wapenlijsten, null, 2));
            
            const message = interaction.message;
            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
              .addFields(
                { name: 'Leveringsstatus', value: 'Geleverd' },
                { name: 'Geleverd door', value: interaction.user.tag },
                { name: 'Serienummer', value: serienummer },
                { name: 'Leveringsdatum', value: new Date().toLocaleString() }
              );
              
            await message.edit({ embeds: [updatedEmbed], components: [] });
            
            const deliveryEmbed = new EmbedBuilder()
              .setColor('#00ff00')
              .setTitle('Wapen Geleverd')
              .setDescription(`Je wapen is geleverd en toegevoegd aan je wapenlijst!`)
              .addFields(
                { name: 'Wapen', value: wapenType, inline: true },
                { name: 'Serienummer', value: serienummer, inline: true },
                { name: 'Geleverd door', value: interaction.user.tag, inline: true }
              )
              .setTimestamp();
              
            await targetUser.send({ embeds: [deliveryEmbed] }).catch(() => {
              interaction.followUp({ 
                content: 'Kon geen DM sturen naar de gebruiker. Mogelijk heeft de gebruiker DMs uitgeschakeld.', 
                ephemeral: true 
              });
            });
            
            await client.stuurLog(
              `Wapen geleverd aan <@${userId}> door ${interaction.user.tag}\n` +
              `Wapen: ${wapenType}\n` +
              `Serienummer: ${serienummer}`,
              'wapens'
            );
            
            await interaction.reply({ 
              content: `Wapen succesvol geleverd en toegevoegd aan de wapenlijst van <@${userId}>.`, 
              ephemeral: true 
            });
          } catch (error) {
            console.error('Fout bij leveren van wapen:', error);
            await interaction.reply({ content: 'Er is een fout opgetreden bij het leveren van het wapen.', ephemeral: true });
          }
        }
      }
    } catch (error) {
      console.error('Fout in interactionCreate event:', error);
    }
  }
};
