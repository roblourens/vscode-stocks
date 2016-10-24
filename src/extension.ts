import * as vscode from 'vscode'
import * as http from 'http'

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
    if (!arrayEq(configuredSymbols, Array.from(items.keys()))) {
        cleanup()
        fillEmpty(configuredSymbols)
    }

    configuredSymbols.forEach(symbol => refreshSymbol(symbol))
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

function refreshSymbol(symbol: string): void {
    const url = `http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol=${symbol}`
    httpGet(url).then(response => {
        const responseObj = JSON.parse(response)

        let item = items.get(symbol)
        const price: number = responseObj.LastPrice
        item.text = `${symbol.toUpperCase()} $${price.toFixed(2)}`
        const config = vscode.workspace.getConfiguration()
        const useColors = config.get('vscode-stocks.useColors', false)
        if (useColors) {
            const change = responseObj.ChangePercent
            const color = change > 0 ? 'lightgreen' :
                change < 0 ? 'pink':
                'white'
            item.color = color
        } else {
            item.color = undefined
        }
    },
    e => console.error(e))
}

function httpGet(url): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
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

    return !arr1.some((item, i) => item !== arr2[i])
}