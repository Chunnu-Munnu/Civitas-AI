/*
  CIVITAS AI - ESP32 Solar Verification Node v2
  WITH I2C ADDRESS SCANNER built in — check Serial Monitor for LCD address
*/

#include <Wire.h>
#include <Adafruit_INA219.h>
#include <LiquidCrystal_I2C.h>

Adafruit_INA219 ina219;

// We'll create the LCD object AFTER finding its address
// For now declare pointer
LiquidCrystal_I2C* lcd = nullptr;
byte lcd_addr = 0;

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 1000;

float voltage    = 0.0;
float current_uA = 0.0;
float power_uW   = 0.0;
int   frameCount = 0;
bool  ina219_ok  = false;
bool  lcd_ok     = false;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  delay(500);

  // ── STEP 1: Scan I2C bus and print all devices ────────────────────
  Serial.println("\n=== I2C SCANNER ===");
  byte found[10];
  int count = 0;

  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("  Found device at 0x");
      Serial.println(addr, HEX);
      if (count < 10) found[count++] = addr;
    }
  }
  Serial.print("  Total devices: ");
  Serial.println(count);
  Serial.println("===================\n");

  // ── STEP 2: Figure out LCD address ────────────────────────────────
  // INA219 is always 0x40. LCD is the OTHER address.
  for (int i = 0; i < count; i++) {
    if (found[i] != 0x40) {    // skip INA219
      lcd_addr = found[i];
      break;
    }
  }

  if (lcd_addr > 0) {
    Serial.print("LCD address detected: 0x");
    Serial.println(lcd_addr, HEX);
    lcd = new LiquidCrystal_I2C(lcd_addr, 16, 2);
    lcd->init();
    lcd->backlight();
    lcd->clear();
    lcd->setCursor(0, 0); lcd->print(" CIVITAS  AI   ");
    lcd->setCursor(0, 1); lcd->print("  Booting...   ");
    lcd_ok = true;
  } else {
    Serial.println("WARNING: No LCD found on I2C bus!");
  }

  delay(1000);

  // ── STEP 3: Init INA219 ───────────────────────────────────────────
  if (ina219.begin()) {
    ina219.setCalibration_16V_400mA();
    ina219_ok = true;
    Serial.println("INA219: OK (16V/400mA mode)");
    if (lcd_ok) {
      lcd->clear();
      lcd->setCursor(0, 0); lcd->print(" INA219: OK    ");
      lcd->setCursor(0, 1); lcd->print(" 16V/400mA cal ");
    }
  } else {
    Serial.println("ERR:INA219_NOT_FOUND");
    if (lcd_ok) {
      lcd->clear();
      lcd->setCursor(0, 0); lcd->print("ERR: INA219!   ");
      lcd->setCursor(0, 1); lcd->print("SDA=D21 SCL=D22");
    }
  }

  Serial.println("CIVITAS_AI_READY");
  delay(2000);
  if (lcd_ok) lcd->clear();
}

void loop() {
  unsigned long now = millis();

  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;

    if (ina219_ok) {
      float busV   = ina219.getBusVoltage_V();
      float shuntV = ina219.getShuntVoltage_mV() / 1000.0;
      voltage = busV + shuntV;

      float current_mA = ina219.getCurrent_mA();
      if (current_mA < 0) current_mA = 0;

      float power_mW = voltage * current_mA;

      current_uA = current_mA * 1000.0;
      power_uW   = power_mW   * 1000.0;
      if (current_uA < 0) current_uA = 0;
      if (power_uW   < 0) power_uW   = 0;

    } else {
      voltage    = 0.0;
      current_uA = 0.0;
      power_uW   = 0.0;
    }

    // ── Serial: voltage(V), current(µA), power(µW) ───────────────
    Serial.print(voltage,    3);
    Serial.print(",");
    Serial.print(current_uA, 2);
    Serial.print(",");
    Serial.println(power_uW, 2);

    // ── LCD display ──────────────────────────────────────────────
    if (lcd_ok) {
      frameCount++;
      lcd->clear();

      if (!ina219_ok) {
        lcd->setCursor(0, 0); lcd->print("INA219 missing!");
        lcd->setCursor(0, 1); lcd->print("SDA=D21 SCL=D22");

      } else if (frameCount % 2 == 0) {
        lcd->setCursor(0, 0);
        lcd->print("V:");
        lcd->print(voltage, 3);
        lcd->print("V");

        lcd->setCursor(0, 1);
        lcd->print("I:");
        if (current_uA >= 1000) {
          lcd->print(current_uA / 1000.0, 2);
          lcd->print("mA");
        } else {
          lcd->print((int)current_uA);
          lcd->print("uA");
        }

      } else {
        lcd->setCursor(0, 0);
        lcd->print("P:");
        if (power_uW >= 1000) {
          lcd->print(power_uW / 1000.0, 3);
          lcd->print("mW");
        } else {
          lcd->print((int)power_uW);
          lcd->print("uW");
        }

        lcd->setCursor(0, 1);
        if (voltage > 0.3 && power_uW > 10) {
          lcd->print("STATUS:ACTIVE  ");
        } else {
          lcd->print("STATUS:LOW     ");
        }
      }
    }
  }
}
