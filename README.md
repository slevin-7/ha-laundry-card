# Waschküche Card

A Home Assistant card to run a Haier/Candy/Hoover washing machine and tumble dryer through the [hOn integration](https://github.com/Andre0512/hon): pick a program, set temperature/spin or dryness, start now or later, and see when it's done. German UI.

It only uses entities you already have (selects, numbers, switches, a start script per machine and an `input_boolean` for "needs emptying"). No extra card libraries.

## Install

HACS → Frontend → ⋮ → Custom repositories → `https://github.com/slevin-7/ha-laundry-card` (type *Dashboard*) → install **Waschküche Card**.

## Configuration

```yaml
type: custom:waschkueche-card
# all optional, these are the defaults
washer: waschmaschine        # entity prefix, false hides the washer
dryer: trockner              # entity prefix, false hides the dryer
washer_name: Waschmaschine
dryer_name: Trockner
favorites_washer: [hqd_eco_40_60_degrees, hqd_cottons, hqd_mix, hqd_quick_15, hqd_synthetic_and_coloured, hqd_smart]
favorites_dryer: [hqd_cotton, hqd_mix, hqd_synthetics, hqd_quick_30, hqd_towel, hqd_bed_sheets]
delays: [0, 60, 180, 360]    # start delay choices in minutes (device uses 30-minute steps)
remote_check: true           # if "remote start" reads off, reload the hOn entry and restore the picked options (hOn only reads it on load)
washer_entities: {}          # override single entities, e.g. { start: script.my_washer_start }
dryer_entities: {}
```

Entities are derived from the prefix `{p}`:

| Key | Washer | Dryer |
|---|---|---|
| program | `select.{p}_programm` | `select.{p}_programm` |
| options | `select.{p}_temperatur`, `select.{p}_schleudern` | `select.{p}_trocknungsstufe`, `number.{p}_temperature_level` |
| start | `script.{p}_starten_mit_optionen` | `script.{p}_starten_mit_optionen` |
| delay | `number.{p}_einschaltverzogerung` (+ `switch.{p}_einschaltverzogerung`) | `number.{p}_einschaltverzogerung` |
| status | `sensor.{p}_machine_status`, `sensor.{p}_phase`, `sensor.{p}_verbleibende_zeit`, `sensor.{p}_fortschritt`, `sensor.{p}_fertig_um` | same |
| remote start allowed | `binary_sensor.{p}_fernsteuerung` | `binary_sensor.{p}_gerateverbindung` |
| needs emptying | `input_boolean.{p}_auszuraumen` | same |
| pause / stop | `switch.{p}_anhalten`, `switch.{p}_{p}` | same |

The start script is yours: the card sets the options first and then runs it, so checks like "remote start enabled" stay in one place.

## Test

`test/harness.html` renders the card with a states dump (`test/states.json`, not committed) and a fake `callService`; `node test/shot.mjs <setup|run|done|remoteoff> [dark|light] ["js"]` takes a screenshot and prints the service calls.

MIT license.
