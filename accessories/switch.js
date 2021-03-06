const baseSwitch = require('./baseSwitch');

let Service, Characteristic, Accessory;

class SwitchAccessory extends baseSwitch {
    constructor(config, platform) {
        super(config, platform);
        Accessory = platform.Accessory;
        Service = platform.Service;
        Characteristic = platform.Characteristic;

        //Config reader
        this.onCode;
        this.offCode;
        //Characteristic
        this.activeState = null;
        this.onState = Characteristic.On.NO;
        this.lastState = this.onState;

        if (!config.data || !config.data.on || !config.data.off) {
            this.log.error("[%s]'data' not defined! Please check your 'config.json' file", this.name);
        } else {
            this.onCode = config.data.on;
            this.offCode = config.data.off;
        }
        this._setCharacteristic();
    }

    _setCharacteristic() {
        this.services = [];

        this.infoService = new Service.AccessoryInformation();
        this.infoService
            .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
            .setCharacteristic(Characteristic.Model, "AC Partner IR Switch")
            .setCharacteristic(Characteristic.SerialNumber, "Undefined");
        this.services.push(this.infoService);

        this.switchService = new Service.Switch(this.name);

        this.activeState = this.switchService.getCharacteristic(Characteristic.On)
            .on('set', this.setSwitchState.bind(this))
            .updateValue(this.onState);

        this.services.push(this.switchService);
    }
    
    setSwitchState(value, callback) {
        if (!this.onCode || !this.offCode) {
            this.log.error("[ERROR]IR code no defined!");
            return;
        }
        if (!this.platform._enterSyncState()) {
            this.platform.syncLockEvent.once("lockDrop", (() => {
                this.setSwitchState(value, callback);
            }));
            return;
        }
        this.onState = value;
        const code = this.onState ? this.onCode : this.offCode;

        this.log.debug("[%s]Sending IR code: %s", this.name, code);
        this.platform.devices[this.deviceIndex].call('send_ir_code', [code])
            .then((ret) => {
                this._switchUpdateState();
                this.log.debug("[%s]Result: %s", this.name, ret);
                callback();
            })
            .catch((err) => {
                this._switchRevertState();
                this.log.error("[%s]Failed! %s", this.name, err);
                callback(err);
            })
            .then(() => {
                //Callback and exit sync state
                this.platform._exitSyncState();
            });
    }
}

//util.inherits(SwitchAccessory, baseSwitch);
module.exports = SwitchAccessory;