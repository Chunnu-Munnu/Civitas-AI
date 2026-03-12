import serial

ser = serial.Serial("COM7", 115200)

print("Reading from ESP32...\n")

while True:
    try:
        line = ser.readline().decode().strip()
        if line:
            print(line)
    except KeyboardInterrupt:
        print("Stopped.")
        break
