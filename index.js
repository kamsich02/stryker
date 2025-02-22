require('dotenv').config();
const { ethers } = require('ethers');

const ETH_MIN_SWEEP = process.env.ETH_MIN_SWEEP;   // ETH MIN SWEEP (from .env)
const WALLET_SWEEP_KEY = process.env.WALLET_SWEEP_KEY;
const PROVIDER_URL = process.env.PROVIDER_URL;
const WALLET_DEST = process.env.WALLET_DEST;
const ETH_GAS_GWEI = process.env.ETH_GAS_GWEI;     // Gas Price in Gwei (from .env)
const GAS_LIMIT = process.env.GAS_LIMIT;           // Gas Limit (from .env)

function printProgress(progress) {
    if (process.stdout.isTTY) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(progress);
    } else {
        console.log(progress); // Fall back to simple logging
    }
}

async function main() {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const walletSweep = new ethers.Wallet(WALLET_SWEEP_KEY, provider);

    // parseUnits returns a BigInt in ethers v6
    const gasPrice = ethers.parseUnits(ETH_GAS_GWEI, 'gwei');  
    const ETH_MIN = ethers.parseUnits(ETH_MIN_SWEEP, 'ether'); 
    const gasLimit = BigInt(GAS_LIMIT); // Convert the gas limit to a BigInt

    let counter = 0;
    let done = 0;
    let errors = 0;

    while (true) {
        counter++;
        let text = `A: ${done} / E: ${errors} / Checked: ${counter} / Balance: `;

        try {
            const balance = await provider.getBalance(walletSweep.address); 
            // 'balance' is a BigInt in ethers v6

            if (balance >= ETH_MIN) {
                try {
                    const nonce = await provider.getTransactionCount(walletSweep.address, 'latest');
                    
                    // Calculate transaction cost as BigInt
                    const txCost = gasPrice * gasLimit; 
                    const transferAmount = balance - txCost; 

                    // Ensure we don't send a negative amount
                    if (transferAmount > 0n) {
                        const tx = {
                            to: WALLET_DEST,
                            value: transferAmount,
                            gasLimit: gasLimit,
                            gasPrice: gasPrice,
                            nonce: nonce
                        };

                        const txResponse = await walletSweep.sendTransaction(tx);
                        await txResponse.wait(); // Wait for transaction to be confirmed

                        const amountSentEth = ethers.formatEther(transferAmount);
                        done++;
                        text += `Sent: ${amountSentEth} ETH`;
                    } else {
                        text += `Not enough balance to cover gas.`;
                    }
                } catch (e) {
                    console.error(e);
                    errors++;
                }
            } else {
                // Just display the current balance
                const view = ethers.formatEther(balance);
                text += `${view} ETH`;
            }
        } catch (e) {
            console.error("Error fetching balance: ", e);
            errors++;
        }
        printProgress(text);
    }
}

main().catch(console.error);
