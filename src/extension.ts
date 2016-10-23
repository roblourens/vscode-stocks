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
    const symbols = config.get('stockmon.stockSymbols', [])
    symbols.forEach(symbol => refreshSymbol(symbol))
}

function refreshSymbol(symbol: string): void {
    symbol = symbol.toUpperCase()
    const url = `http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol=${symbol}`
    httpGet(url).then(response => {
        const responseObj = JSON.parse(response)

        let item: vscode.StatusBarItem
        if (items.has(symbol)) {
            item = items.get(symbol)
        } else {
            item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1)
            item.show()
            items.set(symbol, item)
        }

        item.text = `${symbol}: $${responseObj.LastPrice}`
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