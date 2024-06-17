import CoinKey from 'coinkey';
import walletsArray from './wallets.js';
import chalk from 'chalk';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import { parentPort, workerData } from 'worker_threads';

const walletsSet = new Set(walletsArray);

async function encontrarBitcoins(key, min, max, shouldStop, rand = 0) {
    let segundos = 0;
    let pkey = 0;
    let um = 0;
    if (rand === 0) {
        um = BigInt(1);
    } else {
        um = BigInt(rand);
    }

    const startTime = Date.now();

    let zeroes = new Array(65).fill('');
    for (let i = 1; i < 64; i++) {
        zeroes[i] = '0'.repeat(64 - i);
    }

    console.log('Buscando Bitcoins...');

    key = getRandomBigInt(min, max);

    const executeLoop = async () => {
        while (!shouldStop()) {
            key += um;
            pkey = key.toString(16);
            pkey = `${zeroes[pkey.length]}${pkey}`;

            // parentPort.postMessage({ type: 'key', value: pkey });

            if (Date.now() - startTime > segundos) {
                segundos += 1000;
                console.log(segundos / 1000);
                if (segundos % 10000 == 0) {
                    const tempo = (Date.now() - startTime) / 1000;
                    console.clear();
                    var msg = 'Velocidade:' + (Number(key) - Number(min)) / tempo + ' chaves por segundos | Ultima Chave: ' + pkey + ' | Wallet: ' + generateBTCAddress(pkey) + ' | Tempo: ' + tempo + ' segundos';
                    // console.log('Ultima chave tentada: ', pkey);
                    parentPort.postMessage({ type: 'msg', value: msg });

                    const filePath = 'Ultima_chave.txt';
                    const content = `Ultima chave tentada: ${pkey}`;
                    try {
                        fs.writeFileSync(filePath, content, 'utf8');
                    } catch (err) {
                        console.error('Error writing to file:', err);
                    }

                    key = getRandomBigInt(min, max);

                    if (key >= max) {
                        key = min;
                    }
                }
            }

            let publicKey = generatePublic(pkey);
            if (walletsSet.has(publicKey)) {
                const tempo = (Date.now() - startTime) / 1000;
                console.log('Velocidade:', (Number(key) - Number(min)) / tempo, ' chaves por segundo');
                console.log('Tempo:', tempo, ' segundos');
                console.log('Private key:', chalk.green(pkey));
                console.log('WIF:', chalk.green(generateWIF(pkey)));
                console.log('BTC Address:', chalk.green(generateBTCAddress(pkey)));

                const filePath = 'keys.txt';
                const lineToAppend = `Private key: ${pkey}, WIF: ${generateWIF(pkey)} | Wallet: ${generateBTCAddress(pkey)}\n`;

                try {
                    fs.appendFileSync(filePath, lineToAppend);
                    const result = await checkWalletBalance(pkey, generateBTCAddress(pkey)); // Check balance for the generated wallet address
                    console.log(result);
                } catch (err) {
                    console.error('Erro ao escrever chave em arquivo:', err);
                }

                throw 'ACHEI!!!! 🎉🎉🎉🎉🎉';
            }
        }
        await new Promise(resolve => setImmediate(resolve));
    };
    await executeLoop();
    parentPort.postMessage('Worker completed');
}

function generatePublic(privateKey) {
    let _key = new CoinKey(Buffer.from(privateKey, 'hex'));
    _key.compressed = true;
    return _key.publicAddress;
}

function generateWIF(privateKey) {
    let _key = new CoinKey(Buffer.from(privateKey, 'hex'));
    return _key.privateWif;
}

function generateBTCAddress(privateKey) {
  let _key = new CoinKey(Buffer.from(privateKey, 'hex'));
  _key.compressed = true;
  return _key.publicAddress;
}

function getRandomBigInt(min, max) {
    if (min >= max) {
        throw new Error('min should be less than max');
    }

    const range = max - min;
    const randomBigIntInRange = BigInt(`0x${crypto.randomBytes(32).toString('hex')}`) % range;
    const randomBigInt = min + randomBigIntInRange;

    return randomBigInt;
}

async function checkWalletBalance(pkey, wallet) {
    try {
        const response = await axios.get(`https://bitcoin-blockbook.twnodes.com/api/v2/address/${wallet}?details=full`);
        const data = response.data;
        
        if (data.txs > 0) {
            console.log(`\nPrivate key: ${pkey}`);
            console.log(`\nSaldo da carteira ${wallet}:`);
            console.log(`\nSaldo: ${chalk.yellow(data.balance)}`);
            console.log(`\nTotal recebido: ${chalk.yellow(data.totalReceived)}`);
            console.log(`\nTotal enviado: ${chalk.yellow(data.totalSent)}`);
            console.log(`\nTransações não confirmadas: ${chalk.yellow(data.unconfirmedTxs)}`);
            console.log(`\nTransações confirmadas: ${chalk.yellow(data.txs)}`);
            
            const logMessage = `PUBLIC: ${pkey} | ADDRESS: ${wallet} | BALANCE: ${data.balance} | RECEIVED: ${data.totalReceived} | SENT: ${data.totalSent} | UNCONFIRMED: ${data.unconfirmedTxs} | CONFIRMED: ${data.txs}\n`;
            fs.appendFileSync('wallets-balance.txt', logMessage);
            
            return `[+] ${logMessage}`;
        } else {
            const walletInfo = `Carteira ${wallet} | Saldo: ${chalk.yellow(data.balance)} | Total recebido: ${chalk.yellow(data.totalReceived)} | Total enviado: ${chalk.yellow(data.totalSent)} | Transações não confirmadas: ${chalk.yellow(data.unconfirmedTxs)} | Transações confirmadas: ${chalk.yellow(data.txs)}`;
            console.log(`\n${walletInfo}`);
            return walletInfo;
        }

    } catch (err) {
        console.error(`Erro ao buscar saldo para a carteira ${wallet}:`, err.message);
        return `Carteira ${wallet} | ERRO AO BUSCAR SALDO`;
    }
}

export { encontrarBitcoins, generateBTCAddress };

if (workerData) {
    const shouldStopFunc = new Function(`return ${workerData.shouldStop}`)();
    encontrarBitcoins(BigInt(workerData.key), BigInt(workerData.min), BigInt(workerData.max), shouldStopFunc, workerData.rand);
}
