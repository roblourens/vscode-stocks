import * as vscode from 'vscode'
import * as https from 'https'

let items: Map<string, vscode.StatusBarItem>
export function activate(context: vscode.ExtensionContext) {
    items = new Map<string, vscode.StatusBarItem>();

    refresh()
    setInterval(refresh, 60*1e3)
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(refresh))
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function refresh(): void {
    const config = vscode.workspace.getConfiguration()
    const configuredSymbols = config.get('vscode-stocks.stockSymbols', [])
        .map(symbol => symbol.toUpperCase())

    if (!arrayEq(configuredSymbols, Array.from(items.keys()))) {
        cleanup()
        fillEmpty(configuredSymbols)
    }

    refreshSymbols(configuredSymbols)
}

function fillEmpty(symbols: string[]): void {
    symbols
        .forEach((symbol, i) => {
            // Enforce ordering with priority
            const priority = symbols.length - i
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority)
            item.text = `${symbol}: $…`
            item.show()
            items.set(symbol, item)
        })
}

function cleanup(): void {
    items.forEach(item => {
        item.hide()
        item.dispose()
    })

    items = new Map<string, vscode.StatusBarItem>()
}

async function refreshSymbols(symbols: string[]): Promise<void> {
    if (!symbols.length) {
        return;
    }

    const url = `https://api.iextrading.com/1.0/stock/market/batch?symbols=${symbols.join(',')}&types=quote`
    try {
        const response = await httpGet(url)
        const responseObj = JSON.parse(response)
        Object.keys(responseObj)
            .forEach(key => updateItemWithSymbolQuote(responseObj[key].quote))
    } catch (e) {
        throw new Error(`Invalid response: ${e.message}`);
    }
}

function updateItemWithSymbolQuote(symbolQuote) {
    const symbol = symbolQuote.symbol.toUpperCase()
    const item = items.get(symbol)
    const price: number = symbolQuote.latestPrice

    item.text = `${symbol.toUpperCase()} $${price.toFixed(2)}`
    const config = vscode.workspace.getConfiguration()
    const useColors = config.get('vscode-stocks.useColors', false)
    if (useColors) {
        const change = parseFloat(symbolQuote.change)
        const color = change > 0 ? 'lightgreen' :
            change < 0 ? 'pink':
            'white'
        item.color = color
    } else {
        item.color = undefined
    }
}

function httpGet(url): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            let responseData = '';
            response.on('data', chunk => responseData += chunk);
            response.on('end', () => {
                // Sometimes the 'error' event is not fired. Double check here.
                if (response.statusCode === 200) {
                    resolve(responseData)
                } else {
                    reject('fail: ' + response.statusCode)
                }
            })
        })
    })
}

function arrayEq(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false

    return arr1.every((item, i) => item === arr2[i])
}