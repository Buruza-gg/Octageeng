const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const { SetIntervalAsyncTimer, setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
const axios = require('axios');

const app = express();

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',    
    database: 'ChatBotTests'
});

connection.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
        return;
    }
    console.log('Успешное подключение к базе данных');
});

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '8300259606:AAFcdZUQWpfeu5017d1M7hQlBW8pgBImOhA';
const bot = new TelegramBot(TOKEN, { polling: true });

const allowedCommands = ['/start', '/help', '/site',
'/creator', '/translate'];


async function translateText(text, targetLang = 'en', sourceLang = 'auto') {
    try {
        const response = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
            params: {
                client: 'gtx',
                sl: sourceLang,
                tl: targetLang,
                dt: 't',
                q: text
            }
        });

        if (response.data && response.data[0]) {
            const translatedText = response.data[0]
                .map(item => item[0])
                .filter(text => text)
                .join('');
            

            const detectedLang = response.data[2] || sourceLang;
            
            return {
                text: translatedText,
                from: detectedLang,
                to: targetLang
            };
        } else {
            throw new Error('Некорректный ответ от сервиса перевода');
        }
        
    } catch (error) {
        console.error('Ошибка перевода:', error);
        throw new Error('Не удалось выполнить перевод. Попробуйте позже.');
    }
}


function getLangCode(langName) {
    const normalizedLang = langName.toLowerCase().trim();
    
    const languages = {
        'русский': 'ru', 'русского': 'ru', 'русскому': 'ru', 'русским': 'ru', 'русском': 'ru',
        'русская': 'ru', 'русской': 'ru', 'русскую': 'ru', 'русские': 'ru', 'русских': 'ru',
        'рускай': 'ru', 'рускага': 'ru', 'рускаму': 'ru', 'рускі': 'ru', 'руской': 'ru',
        'russian': 'ru', 'ru': 'ru', 'rus': 'ru', 'ruski': 'ru', 'rusă': 'ru',
        'ruso': 'ru', 'rusça': 'ru', 'რუსული': 'ru', 'orys': 'ru', 'орыс': 'ru',
        'російська': 'ru', 'російський': 'ru', 'росиё': 'ru', 'روسی': 'ru',

        'английский': 'en', 'английского': 'en', 'английскому': 'en', 'английским': 'en', 'английском': 'en',
        'английская': 'en', 'английской': 'en', 'английскую': 'en', 'английские': 'en', 'английских': 'en',
        'ангельский': 'en', 'ангельского': 'en', 'ангельскому': 'en', 'ангельским': 'en', 'ангельском': 'en',
        'ангельская': 'en', 'ангельской': 'en', 'ангельскую': 'en',
        'англійська': 'en', 'англійський': 'en', 'ағылшын': 'en', 'ingliz': 'en', 'english': 'en',
        'en': 'en', 'eng': 'en', 'anglais': 'en', 'inglés': 'en', 'ingilizce': 'en',
        'angielski': 'en', 'englisch': 'en', 'inglese': 'en', 'inglise': 'en', 'инглизӣ': 'en',

        'украинский': 'uk', 'украинского': 'uk', 'украинскому': 'uk', 'украинским': 'uk', 'украинском': 'uk',
        'украинская': 'uk', 'украинской': 'uk', 'украинскую': 'uk', 'украинские': 'uk', 'украинских': 'uk',
        'українська': 'uk', 'український': 'uk', 'украінскі': 'uk', 'украінская': 'uk',
        'ukrainian': 'uk', 'uk': 'uk', 'ucraniano': 'uk', 'ukrayna': 'uk', 'ucraïna': 'uk',
        'ucraino': 'uk', 'ukrainska': 'uk', 'ukrainskij': 'uk', 'україна': 'uk',

        'белорусский': 'be', 'белорусского': 'be', 'белорусскому': 'be', 'белорусским': 'be', 'белорусском': 'be',
        'белорусская': 'be', 'белорусской': 'be', 'белорусскую': 'be', 'белорусские': 'be', 'белорусских': 'be',
        'беларускі': 'be', 'беларуская': 'be', 'белоруской': 'be', 'белоруская': 'be',
        'belarusian': 'be', 'be': 'be', 'bielorruso': 'be', 'bélarus': 'be', 'bielorrusso': 'be',
        'vitrysk': 'be', 'belarus': 'be', 'bjeloruski': 'be',

        'казахский': 'kk', 'казахского': 'kk', 'казахскому': 'kk', 'казахским': 'kk', 'казахском': 'kk',
        'казахская': 'kk', 'казахской': 'kk', 'казахскую': 'kk', 'казахские': 'kk', 'казахских': 'kk',
        'қазақ': 'kk', 'қазақша': 'kk', 'qazaq': 'kk', 'qazaqsha': 'kk',
        'kazakh': 'kk', 'kk': 'kk', 'kazajo': 'kk', 'kazaco': 'kk', 'kazak': 'kk',
        'kazax': 'kk', 'قازاق': 'kk',

        'узбекский': 'uz', 'узбекского': 'uz', 'узбекскому': 'uz', 'узбекским': 'uz', 'узбекском': 'uz',
        'узбекская': 'uz', 'узбекской': 'uz', 'узбекскую': 'uz', 'узбекские': 'uz', 'узбекских': 'uz',
        'o‘zbek': 'uz', 'o‘zbekcha': 'uz', 'ozbek': 'uz', 'ozbekcha': 'uz',
        'uzbek': 'uz', 'uz': 'uz', 'uzbeko': 'uz', 'ousbek': 'uz', 'usbekisch': 'uz',
        'özbək': 'uz', 'ازبک': 'uz',

        'азербайджанский': 'az', 'азербайджанского': 'az', 'азербайджанскому': 'az', 'азербайджанским': 'az', 'азербайджанском': 'az',
        'азербайджанская': 'az', 'азербайджанской': 'az', 'азербайджанскую': 'az', 'азербайджанские': 'az', 'азербайджанских': 'az',
        'azərbaycan': 'az', 'azərbaycanca': 'az', 'azerbaijani': 'az', 'az': 'az', 'azerí': 'az',
        'azerbaïdjanais': 'az', 'azeri': 'az', 'azerbaycan': 'az', 'آذربایجان': 'az',

        'армянский': 'hy', 'армянского': 'hy', 'армянскому': 'hy', 'армянским': 'hy', 'армянском': 'hy',
        'армянская': 'hy', 'армянской': 'hy', 'армянскую': 'hy', 'армянские': 'hy', 'армянских': 'hy',
        'հայերեն': 'hy', 'hayeren': 'hy', 'armenian': 'hy', 'hy': 'hy', 'armenia': 'hy',
        'arménien': 'hy', 'armeno': 'hy', 'armênio': 'hy', 'ermeni': 'hy', 'арман': 'hy',

        'грузинский': 'ka', 'грузинского': 'ka', 'грузинскому': 'ka', 'грузинским': 'ka', 'грузинском': 'ka',
        'грузинская': 'ka', 'грузинской': 'ka', 'грузинскую': 'ka', 'грузинские': 'ka', 'грузинских': 'ka',
        'ქართული': 'ka', 'kartuli': 'ka', 'georgian': 'ka', 'ka': 'ka', 'georgiano': 'ka',
        'géorgien': 'ka', 'georgisch': 'ka', 'georgiano': 'ka', 'gürcü': 'ka', 'گرجی': 'ka',

        'молдавский': 'ro', 'молдавского': 'ro', 'молдавскому': 'ro', 'молдавским': 'ro', 'молдавском': 'ro',
        'молдавская': 'ro', 'молдавской': 'ro', 'молдавскую': 'ro', 'молдавские': 'ro', 'молдавских': 'ro',
        'moldovenesc': 'ro', 'moldovenească': 'ro', 'moldovan': 'ro', 'ro': 'ro', 'moldavo': 'ro',
        'moldave': 'ro', 'moldauisch': 'ro', 'moldavskij': 'ro', 'moldova': 'ro',

        'таджикский': 'tg', 'таджикского': 'tg', 'таджикскому': 'tg', 'таджикским': 'tg', 'таджикском': 'tg',
        'таджикская': 'tg', 'таджикской': 'tg', 'таджикскую': 'tg', 'таджикские': 'tg', 'таджикских': 'tg',
        'тоҷикӣ': 'tg', 'tojikī': 'tg', 'tajik': 'tg', 'tg': 'tg', 'tayiko': 'tg',
        'tadjik': 'tg', 'tadschikisch': 'tg', 'tacik': 'tg', 'تاجیک': 'tg',

        'туркменский': 'tk', 'туркменского': 'tk', 'туркменскому': 'tk', 'туркменским': 'tk', 'туркменском': 'tk',
        'туркменская': 'tk', 'туркменской': 'tk', 'туркменскую': 'tk', 'туркменские': 'tk', 'туркменских': 'tk',
        'türkmen': 'tk', 'türkmence': 'tk', 'turkmen': 'tk', 'tk': 'tk', 'turcomano': 'tk',
        'turkmène': 'tk', 'turkmenisch': 'tk', 'türkmençe': 'tk', 'ترکمن': 'tk',

        'киргизский': 'ky', 'киргизского': 'ky', 'киргизскому': 'ky', 'киргизским': 'ky', 'киргизском': 'ky',
        'киргизская': 'ky', 'киргизской': 'ky', 'киргизскую': 'ky', 'киргизские': 'ky', 'киргизских': 'ky',
        'кыргыз': 'ky', 'кыргызча': 'ky', 'qırğız': 'ky', 'qırğızca': 'ky',
        'kyrgyz': 'ky', 'ky': 'ky', 'kirguís': 'ky', 'kirghiz': 'ky', 'kirgisisch': 'ky',
        'kirgiz': 'ky', 'قرقیز': 'ky',

        'литовский': 'lt', 'литовского': 'lt', 'литовскому': 'lt', 'литовским': 'lt', 'литовском': 'lt',
        'литовская': 'lt', 'литовской': 'lt', 'литовскую': 'lt', 'литовские': 'lt', 'литовских': 'lt',
        'lietuvių': 'lt', 'lietuvį': 'lt', 'lithuanian': 'lt', 'lt': 'lt', 'lituano': 'lt',
        'lituanien': 'lt', 'litauisch': 'lt', 'litvanca': 'lt', 'لیتوانی': 'lt',

        'латышский': 'lv', 'латышского': 'lv', 'латышскому': 'lv', 'латышским': 'lv', 'латышском': 'lv',
        'латышская': 'lv', 'латышской': 'lv', 'латышскую': 'lv', 'латышские': 'lv', 'латышских': 'lv',
        'latviešu': 'lv', 'latvietis': 'lv', 'latvian': 'lv', 'lv': 'lv', 'letón': 'lv',
        'leton': 'lv', 'lettisch': 'lv', 'letonca': 'lv', 'لتونی': 'lv',

        'эстонский': 'et', 'эстонского': 'et', 'эстонскому': 'et', 'эстонским': 'et', 'эстонском': 'et',
        'эстонская': 'et', 'эстонской': 'et', 'эстонскую': 'et', 'эстонские': 'et', 'эстонских': 'et',
        'eesti': 'et', 'eestlane': 'et', 'estonian': 'et', 'et': 'et', 'estonio': 'et',
        'estonien': 'et', 'estnisch': 'et', 'estonyaca': 'et', 'استونی': 'et',

        'турецкий': 'tr', 'турецкого': 'tr', 'турецкому': 'tr', 'турецким': 'tr', 'турецком': 'tr',
        'турецкая': 'tr', 'турецкой': 'tr', 'турецкую': 'tr', 'турецкие': 'tr', 'турецких': 'tr',
        'türk': 'tr', 'türkçe': 'tr', 'turkish': 'tr', 'tr': 'tr', 'turco': 'tr',
        'turc': 'tr', 'türkisch': 'tr', 'turkcə': 'tr', 'ترکی': 'tr'
    };
    
    const code = languages[normalizedLang];
    if (!code) {
        throw new Error(`Язык "${langName}" не поддерживается. Используйте любой из 16 языков: русский, английский, украинский, белорусский, казахский, узбекский, азербайджанский, армянский, грузинский, молдавский, таджикский, туркменский, киргизский, литовский, латышский, эстонский, турецкий`);
    }
    return code;
}

function updateUserLastMessage(userId) {
    const query = `
        INSERT INTO Users (id, lastMessage)
        VALUES (?, NOW())
        ON DUPLICATE KEY UPDATE lastMessage = NOW()
    `;
   
    connection.query(query, [userId], (error, results) => {
        if (error) {
            console.error('Ошибка при обновлении пользователя:', error);
        } else {
            if (results.affectedRows > 0) {
                console.log(`Обновлена запись пользователя ${userId}`);
            }
        }
    });
}

bot.onText(/\/translate(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    updateUserLastMessage(chatId);
    
    if (!match[1]) {
        const helpText = `
*Команда перевода*

Использование:
• /translate текст - перевести на английский
• /translate на язык: текст - перевести на указанный язык
• /translate с языка на язык: текст - перевести между языками

*Примеры на разных языках:*
\`/translate Привет, как дела?\`
\`/translate на английский: Привет, как дела?\`
\`/translate на ангельскую: Прывітанне\`
\`/translate з беларускай на українську: Добры дзень\`
\`/translate с русского на қазақша: Сәлеметсіз бе\`
\`/translate o‘zbekcha to‘g‘risida: Hello world\`
\`/translate azərbaycanca necəsən: How are you\`

*Поддерживаемые 16 языков:*
🇷🇺 Русский • 🇺🇦 Украинский • 🇧🇾 Белорусский
🇰🇿 Казахский • 🇺🇿 Узбекский • 🇦🇿 Азербайджанский
🇦🇲 Армянский • 🇬🇪 Грузинский • 🇲🇩 Молдавский
🇹🇯 Таджикский • 🇹🇲 Туркменский • 🇰🇬 Киргизский
🇱🇹 Литовский • 🇱🇻 Латышский • 🇪🇪 Эстонский
🇹🇷 Турецкий • 🇬🇧 Английский
        `;
        
        bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
        return;
    }
    
    const inputText = match[1].trim();
    
    try {
        const processingMsg = await bot.sendMessage(chatId, 'Перевод...');
        
        let targetLang = 'en'; 
        let sourceLang = 'auto'; 
        let textToTranslate = inputText;

        const normalizedInput = inputText.toLowerCase();
        
        const toPrepositions = ['на', 'у', 'to', 'a', 'в', 'into', 'til', 'do', 'gə', 'qədər'];
        
        const fromPrepositions = ['с', 'з', 'from', 'de', 'из', 'dan', 'danış', 'dən', 'alıb'];
        
        let toMatch = null;
        for (const prep of toPrepositions) {
            const regex = new RegExp(`^${prep}\\s+([^:]+):\\s*(.+)`, 'i');
            toMatch = normalizedInput.match(regex);
            if (toMatch) break;
        }
        
        if (toMatch) {
            targetLang = getLangCode(toMatch[1].trim());
            textToTranslate = toMatch[2].trim();
        } else {
            let fromMatch = null;
            for (const fromPrep of fromPrepositions) {
                for (const toPrep of toPrepositions) {
                    const regex = new RegExp(`^${fromPrep}\\s+([^\\s]+)\\s+${toPrep}\\s+([^:]+):\\s*(.+)`, 'i');
                    fromMatch = normalizedInput.match(regex);
                    if (fromMatch) break;
                }
                if (fromMatch) break;
            }
            
            if (fromMatch) {
                sourceLang = getLangCode(fromMatch[1].trim());
                targetLang = getLangCode(fromMatch[2].trim());
                textToTranslate = fromMatch[3].trim();
            } else {
                for (const fromPrep of fromPrepositions) {
                    for (const toPrep of toPrepositions) {
                        const parts = normalizedInput.split(new RegExp(`\\s*${fromPrep}\\s*|\\s*${toPrep}\\s*`, 'i'));
                        if (parts.length >= 3) {
                            const colonIndex = parts[2].indexOf(':');
                            if (colonIndex !== -1) {
                                sourceLang = getLangCode(parts[1].trim());
                                targetLang = getLangCode(parts[2].substring(0, colonIndex).trim());
                                textToTranslate = parts[2].substring(colonIndex + 1).trim();
                                break;
                            }
                        }
                    }
                    if (textToTranslate !== inputText) break;
                }
            }
        }
        
        if (!textToTranslate || textToTranslate === inputText) {
            textToTranslate = inputText;
            targetLang = 'en';
            sourceLang = 'auto';
        }

        if (textToTranslate.length > 500) {
            bot.editMessageText('Ошибка: Текст слишком длинный (максимум 500 символов)', {
                chat_id: chatId,
                message_id: processingMsg.message_id
            });
            return;
        }

        const translation = await translateText(textToTranslate, targetLang, sourceLang);

        if (!translation.text) {
            throw new Error('Получен пустой перевод');
        }
        
        const resultText = `
*Перевод завершен!*

*Исходный текст (${translation.from}):*
${textToTranslate}

*Перевод (${translation.to}):*
${translation.text}
        `;
        
        bot.editMessageText(resultText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'Markdown'
        });
        
    } catch (error) {
        console.error('Ошибка при переводе:', error);
        
        let errorMessage = `Ошибка перевода: ${error.message}`;
        if (error.message.includes('не поддерживается')) {
            errorMessage += '\n\n*Доступные языки:* русский, английский, украинский, белорусский, казахский, узбекский, азербайджанский, армянский, грузинский, молдавский, таджикский, туркменский, киргизский, литовский, латышский, эстонский, турецкий';
        }
        
        bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
    }
});


bot.onText(/^\!tr(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    updateUserLastMessage(chatId);
    
    if (!match[1]) {
        bot.sendMessage(chatId, 'Использование: `!tr текст` - быстрый перевод на английский', { parse_mode: 'Markdown' });
        return;
    }
    
    const textToTranslate = match[1].trim();
    
    try {

        if (textToTranslate.length > 500) {
            bot.sendMessage(chatId, 'Ошибка: Текст слишком длинный (максимум 500 символов)');
            return;
        }
        
        const translation = await translateText(textToTranslate, 'en');
        

        if (!translation.text) {
            throw new Error('Получен пустой перевод');
        }
        
        const resultText = `
*Быстрый перевод:*
${translation.text}
        `;
        bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Ошибка при быстром переводе:', error);
        bot.sendMessage(chatId, `Ошибка перевода: ${error.message}`);
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `
Мегапуперсупер Переводчик!

Используйте:
• /translate - помощь по переводу
• !tr текст - быстрый перевод на английский

Пример: /translate с русского на грузинский: Доброе утро

Теперь поддерживаются языки бывших советских республик!
    `;
    

    updateUserLastMessage(chatId);
    
    bot.sendMessage(chatId, welcomeText);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
Список доступных команд:
/start - Начать работу с ботом
/help - Показать это сообщение
/site - Отправляет в чат ссылку на сайт октагона
/creator - Показать информацию о создателе бота
/translate - Переводчик текста
!tr - Быстрый перевод на английский (использование: !tr текст)

*Примеры перевода:*
• /translate Привет мир
• /translate на белорусский: Как дела?
• /translate с русского на казахский: Доброе утро

*Поддерживаются языки бывших советских республик:*
русский, украинский, белорусский, казахский, узбекский, азербайджанский, армянский, грузинский, молдавский, таджикский, туркменский, киргизский, литовский, латышский, эстонский
    `;
    

    updateUserLastMessage(chatId);
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/\/site/, (msg) => {
    const chatId = msg.chat.id;
    const siteUrl = 'https://octagon-students.ru/';
    const siteText = `Сайт Октагона: ${siteUrl}`;
    

    updateUserLastMessage(chatId);
    
    bot.sendMessage(chatId, siteText);
});

bot.onText(/\/creator/, (msg) => {
    const chatId = msg.chat.id;
    const creatorName = 'Нефедьев Евгений Алексеевич';
    const creatorText = `Создатель бота: ${creatorName}`;


    updateUserLastMessage(chatId);
    
    bot.sendMessage(chatId, creatorText);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    

    updateUserLastMessage(chatId);
    
    const isAllowedCommand = allowedCommands.some(command =>
        msg.text.toLowerCase() === command.toLowerCase() ||
        msg.text.toLowerCase().startsWith(command.toLowerCase() + '@') ||
        msg.text.toLowerCase().startsWith('/translate') ||
        msg.text.toLowerCase().startsWith('!tr')
    );
    
    if (!isAllowedCommand && msg.text.startsWith('/')) {
        const errorText = `
Ошибка: Неизвестная команда

Доступные команды:
/help - Список команд с описанием  
/site - Ссылка на сайт Октагона
/creator - Информация о создателе
/translate - Переводчик текста
!tr - Быстрый перевод на английский

Пожалуйста, используйте только указанные команды.
        `;
        
        bot.sendMessage(chatId, errorText, { parse_mode: 'Markdown' });
    }
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error);
});

bot.on('webhook_error', (error) => {
    console.log('Webhook error:', error);
});

console.log('Бот запущен и ожидает сообщений...');