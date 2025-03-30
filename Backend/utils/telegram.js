const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configuration VIP
const vipConfig = {
  fields: {
    Informatique: 'isVIPInformatique',
    Marketing: 'isVIPMarketing',
    Energie: 'isVIPEnergie',
    Réparation: 'isVIPReparation'
  },
  labels: {
    Informatique: 'VIP Informatique',
    Marketing: 'VIP Marketing',
    Energie: 'VIP Energie',
    Réparation: 'VIP Réparation'
  }
};

// Envoi du message avec boutons
const sendTelegramMessage = async (vipType, userId, chatId) => {
  await bot.telegram.sendMessage(
    chatId,
    `Demande ${vipConfig.labels[vipType]} pour l'utilisateur ${userId} :`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: '✅ Valider', 
              callback_data: `validate_${vipType}_${userId}`
            },
            { 
              text: '❌ Annuler', 
              callback_data: `cancel_${vipType}_${userId}` // Ajout du type VIP
            }
          ]
        ]
      }
    }
  );
};

// Validation d'un VIP
bot.action(/validate_(Informatique|Marketing|Energie|Réparation)_([0-9a-fA-F]{24})/, async (ctx) => {
  const [_, vipType, userId] = ctx.match;
  const vipField = vipConfig.fields[vipType];

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { [vipField]: true } },
      { new: true }
    );

    await ctx.answerCbQuery('✅ VIP activé !');

    // Formater le message WhatsApp
    const whatsappMessage = `
    🎉 *Félicitations et bienvenue chez Kaboretech* 🇧🇫
    
    Votre compte a été validé avec succès pour le statut *${vipConfig.labels[vipType]}*. Nous sommes ravis de vous compter parmi nos membres VIP !
    
    Cordialement,
    *L’équipe Kabore Tech* 💼🚀
        `;

    // Envoi du message sur WhatsApp à l'utilisateur
    const formattedPhone = user.phone;  // Assurez-vous que l'utilisateur a un numéro de téléphone formaté
    await sendWhatsAppMessage(formattedPhone, whatsappMessage);

    // Mise à jour du message dans Telegram
    await ctx.editMessageText(
      `Statut ${vipConfig.labels[vipType]} ACTIVÉ pour ${user.name}. \nVous pouvez maintenant choisir un autre statut VIP.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            ...Object.keys(vipConfig.fields).map((type) => {
              if (type !== vipType && !user[vipConfig.fields[type]]) {
                return [
                  { 
                    text: `🔄 Activer ${vipConfig.labels[type]}`, 
                    callback_data: `validate_${type}_${userId}`
                  }
                ];
              }
              return [];
            }),
            [
              { 
                text: '❌ Annuler', 
                callback_data: `cancel_${vipType}_${userId}` 
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    ctx.answerCbQuery('❌ Erreur lors de l\'activation');
  }
});

// Annulation d'un VIP
bot.action(/cancel_(Informatique|Marketing|Energie|Réparation)_([0-9a-fA-F]{24})/, async (ctx) => {
  const [_, vipType, userId] = ctx.match;
  const vipField = vipConfig.fields[vipType];

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { [vipField]: false } }, // Désactivation du VIP
      { new: true }
    );

    await ctx.answerCbQuery('🗑️ VIP annulé');
    // Mise à jour des boutons après annulation avec toutes les options à nouveau disponibles
    await ctx.editMessageText(
      `Statut ${vipConfig.labels[vipType]} DÉSACTIVÉ pour ${user.name}. \nVous pouvez maintenant réactiver un autre statut VIP.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            // Restauration des boutons pour tous les VIP
            ...Object.keys(vipConfig.fields).map((type) => {
              return [
                { 
                  text: `🔄 Activer ${vipConfig.labels[type]}`, 
                  callback_data: `validate_${type}_${userId}`
                }
              ];
            }),
            [
              { 
                text: '❌ Annuler', 
                callback_data: `cancel_${vipType}_${userId}` 
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    ctx.answerCbQuery('❌ Erreur lors de l\'annulation');
  }
});


module.exports = { sendTelegramMessage, bot };