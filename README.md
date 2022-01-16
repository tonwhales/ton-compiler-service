# TON compiler service

Service for compilation of TON smart contracts. Useful for web services, access from the browser or contract verification.

## How to use

You can use securely deployed service at `https://compiler.tonhubapi.com/`.

To compile contract POST sources and parameters to `https://compiler.tonhubapi.com/compile`:
```json
{
	"code": "() recv_internal(slice in_msg) impure { } ",
	"libs":["stdlib"]
}
```

This will return:
```json
{
	"exit_code": 0,
	"stderr": "",
	"stdout": "",
	"fift": "PROGRAM{\n  DECLPROC recv_internal\n  recv_internal PROC:<{\n    //  in_msg\n    DROP\t// \n  }>\n}END>c",
	"cell": "te6ccgEBAgEAEQABFP8A9KQT9LzyyAsBAATTMA=="
}
```

### License

MIT