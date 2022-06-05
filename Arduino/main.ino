/Importing required libs/
/Used ESP32 dec board/
#include "DHT.h"
#include <WiFi.h>
#include <FirebaseESP32.h>


#include <SoftwareSerial.h>
#include <Wire.h>

/*Your credentials in string*/
#define FIREBASE_HOST "smart-agriot-6e5ca-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "rZYRaYnTIw48DcL6sOKbaXEMUUrp1xIR5f1Q0ZEG"
#define WIFI_SSID "Omkar"
#define WIFI_PASSWORD "india@75"
FirebaseData firebaseData; // Firebase object

#define DHTPIN 32     // DHT connected to pin 32
#define DHTTYPE DHT11 // create an instance of DHT sensor

#define soil_sensor_1 15 // input to ESP32 from soil sensor 1
#define soil_sensor_2 16 // input to ESP32 from soil sensor 2

#define sensepin1 21 // output from ESP32 to relay for sensor 1
#define sensepin2 32 // output from ESP32 to relay for sensor 2
#define sensepin4 14 // output from ESP32 to relay for AC motor

#define IRSensor 18       // IR Sensor connected to pin 18
const byte buzzerPin = 4; //buzzerPin = 4;
#define RE 8 // Defining reciever enable pin
#define DE 7 // Defining data enable pin

/*Active buzzer parameters*/
int freq = 2000;
int channel = 0;
int resolution = 8;
int dutyCycle = 128;

// Initializing DHT sensor
DHT dht(DHTPIN, DHTTYPE);
float h = 0.0;
float t = 0.0;

int water1;   // variable for sensor 1
int water2;   // variable for sensor 2

int flag = 1; // to make a delay in first cycle only for AC motor

// Manual mode soil sensor controls(user control parameters)
int vlv_1 = 0;
int vlv_2 = 0;
 
// strings of manual controls
String vlv_1_str;
String vlv_2_str;
String mode_op_str;

// Status Signals
int mode_op = 0;
int manual = 0;
int auto_mode = 1;


const byte nitro[] = {0x01,0x03, 0x00, 0x1e, 0x00, 0x01, 0xe4, 0x0c};
const byte phos[] = {0x01,0x03, 0x00, 0x1f, 0x00, 0x01, 0xb5, 0xcc};
const byte pota[] = {0x01,0x03, 0x00, 0x20, 0x00, 0x01, 0x85, 0xc0};
byte values[11];
SoftwareSerial mod(2,3);

void WiFiConnection()
{

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD); // connecting tO WIFI
    Serial.print("Connecting to Wi-Fi");

    while (WiFi.status() != WL_CONNECTED) // Waiting(looping) until WIFI is connected
    {
        Serial.print(".");
        delay(300);
    }

    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP()); // printing IP address if connected to WIFI

    Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH); // Initializing firebase
    Firebase.reconnectWiFi(true);
}

//Reading nitrogen value.
byte nitrogen(){
  digitalWrite(DE,HIGH);
  digitalWrite(RE,HIGH);
  delay(10);
  if(mod.write(nitro,sizeof(nitro))==8){
    digitalWrite(DE,LOW);
    digitalWrite(RE,LOW);
    for(byte i=0;i<7;i++){
    //Serial.print(mod.read(),HEX);
    values[i] = mod.read();
    Serial.print(values[i],HEX);
    }
    Serial.println();
  }
  return values[4];
}

//Reading phosphorous value.
byte phosphorous(){
  digitalWrite(DE,HIGH);
  digitalWrite(RE,HIGH);
  delay(10);
  if(mod.write(phos,sizeof(phos))==8){
    digitalWrite(DE,LOW);
    digitalWrite(RE,LOW);
    for(byte i=0;i<7;i++){
    //Serial.print(mod.read(),HEX);
    values[i] = mod.read();
    Serial.print(values[i],HEX);
    }
    Serial.println();
  }
  return values[4];
}

//Reading potassium value.
byte potassium(){
  digitalWrite(DE,HIGH);
  digitalWrite(RE,HIGH);
  delay(10);
  if(mod.write(pota,sizeof(pota))==8){
    digitalWrite(DE,LOW);
    digitalWrite(RE,LOW);
    for(byte i=0;i<7;i++){
    //Serial.print(mod.read(),HEX);
    values[i] = mod.read();
    Serial.print(values[i],HEX);
    }
    Serial.println();
  }
  return values[4];
}


void setup()
{

    // serial monitor baude rate
    // std for ESP = 115200
    Serial.begin(115200);
    mod.begin(115200);

    //call begin to start sensor
    dht.begin();

    // Defing output pins for relay
    pinMode(sensepin1, OUTPUT);
    pinMode(sensepin2, OUTPUT);
    pinMode(sensepin4, OUTPUT);
    digitalWrite(sensepin1, HIGH);
    digitalWrite(sensepin2, HIGH);
    digitalWrite(sensepin4, HIGH);

    // Defing input pins for soil sensors
    pinMode(soil_sensor_1, INPUT);
    pinMode(soil_sensor_2, INPUT);

    // IR sensor
    pinMode(IRSensor, INPUT);

    // Buzzer

    ledcSetup(channel, freq, resolution);
    ledcAttachPin(buzzerPin, channel);

    //NPK sensor
    pinMode(RE, OUTPUT);
    pinMode(DE, OUTPUT);

    // connecting to WIFI
    WiFiConnection();
}

// starting execution of main code
void loop()
{

    //Fetching string data and converting it to int data type/
    Firebase.getString(firebaseData, "/mode");
    Serial.println(firebaseData.stringData());
    mode_op_str = firebaseData.stringData();
    mode_op = mode_op_str.toInt();

    Firebase.getString(firebaseData, "/p1");
    Serial.println(firebaseData.stringData());
    vlv_1_str = firebaseData.stringData();
    vlv_1 = vlv_1_str.toInt();

    Firebase.getString(firebaseData, "/p2");
    Serial.println(firebaseData.stringData());
    vlv_2_str = firebaseData.stringData();
    vlv_2 = vlv_2_str.toInt();


    //Reading values of NPK sensor
    byte val1,val2,val3;
    val1 = nitrogen();
    delay(250);
    val2 = phosphorous();
    delay(250);
    val3 = potassium();
    
    // deciding mode of operation
    if (mode_op == 1)
    {
        manual = 1;
        auto_mode = 0;
    }
    else if (mode_op == 0)
    {
        manual = 0;
        auto_mode = 1;
    }

    water1 = digitalRead(15); // reading the coming signal from the soil sensor1
    water2 = digitalRead(16); // reading the coming signal from the soil sensor2

    // controlling automatic/manual motor setup
    if (water1 == HIGH || water2 == HIGH || manual == 1)
    {
        if (auto_mode == 1 || (manual == 1 && (vlv_1 == 1 || vlv_2 == 1)))
        {
            digitalWrite(sensepin4, LOW);
        }
        else
        {
            digitalWrite(sensepin4, HIGH);
        }

        if (flag && auto_mode == 1)
        {
            delay(5000);
            flag = 0;
        }

        if ((water1 == HIGH && auto_mode == 1) || (manual == 1 && vlv_1 == 1))
        {
            digitalWrite(sensepin1, LOW);
        }
        else if ((water1 == LOW && auto_mode == 1) || (manual == 1 && vlv_1 == 0))
        {
            digitalWrite(sensepin1, HIGH);
        }

        if ((water2 == HIGH && auto_mode == 1) || (manual == 1 && vlv_2 == 1))
        {
            digitalWrite(sensepin2, LOW);
        }
        else if ((water2 == LOW && auto_mode == 1) || (manual == 1 && vlv_2 == 0))
        {
            digitalWrite(sensepin2, HIGH);
        }
    }

    // normal opening all relays
    else if (water1 == LOW && water2 == LOW && manual == 0)
    {
        digitalWrite(sensepin1, HIGH);
        digitalWrite(sensepin2, HIGH);
        digitalWrite(sensepin4, HIGH);
        flag = 1;
    }

    // sending data to firebase
    h = dht.readHumidity();    // Read humidity in percentage
    t = dht.readTemperature(); // Read temperature in Celsius

    int statusSensor = digitalRead(IRSensor); // data from IR Sensor
    if (statusSensor == 1 || h >= 40)
    {
        ledcWrite(channel, dutyCycle);
    } // Buzzer High
    else
    {
        ledcWrite(channel, 0);
    } // Buzzer LOW

    // Check if any reads failed and exit early (to try again).
    if (isnan(h) || isnan(t))
    {
        Serial.println("Failed to read from DHT sensor!");
    }

    // print the result to Terminal
    Serial.print("Humidity: ");
    Serial.print(h);
    Serial.print(" %\t");
    Serial.print("Temperature: ");
    Serial.print(t);
    Serial.println(" *C ");
    Serial.print("Nitrogen: ");
    Serial.print(val1);
    Serial.println(" mg/kg");
    Serial.print("Phosphorous: ");
    Serial.print(val2);
    Serial.println(" mg/kg");
    Serial.print("Potassium: ");
    Serial.print(val3);
    Serial.println(" mg/kg");
    //we delay a little bit for next read
    delay(500);

    // flushing data to firebase
    Serial.println("Sending data");
    Firebase.setFloat(firebaseData, "Temperature", t);
    Firebase.setFloat(firebaseData, "Humidity", h);
    Firebase.setInt(firebaseData, "Valve 1", water1);
    Firebase.setInt(firebaseData, "Valve 2", water2);
    Firebase.setFloat(firebaseData, "n", val1);
    Firebase.setFloat(firebaseData, "p", val2);
    Firebase.setFloat(firebaseData, "k", val3);
}
