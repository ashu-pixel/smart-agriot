from flask import Flask, render_template, request
import pandas as pd
import numpy as np
import pickle as pk
from sklearn.preprocessing import LabelEncoder
import re
from nltk.stem.porter import PorterStemmer
#import tensorflow as tf
from keras.utils import np_utils
from keras.models import load_model
import json
import random

app = Flask(__name__)

def IntentLabelMap():
    # Importing dataset and splitting into words and labels
    dataset = pd.read_csv('datasets/intent.csv', names=["Query", "Intent"])
    y = dataset["Intent"]
    # Encode the intent classes
    labelencoder_intent = LabelEncoder()
    y = labelencoder_intent.fit_transform(y)
    y = np_utils.to_categorical(y)
    # print("Encoded the intent classes!")
    # print(y)
    # Return a dictionary, mapping labels to their integer values
    res = {}
    for cl in labelencoder_intent.classes_:
        res.update({cl: labelencoder_intent.transform([cl])[0]})
    intent_label_map = res
    return intent_label_map

intent_model = load_model('saved_state/intent_model.h5')
#intent_model = load_model('saved_state/intent_model.tflite')

#converter = tf.lite.TFLiteConverter.from_keras_model(intent_model)
#tflite_model = converter.convert()
intent_label_map = IntentLabelMap()

# Load Entity model
entity_label_map = pk.load(open('saved_state/entity_model.sav', 'rb'))
loadedEntityCV = pk.load(open('saved_state/EntityCountVectorizer.sav', 'rb'))
loadedEntityClassifier = pk.load(open('saved_state/entity_model.sav', 'rb'))

with open('datasets/intents.json') as json_data:
    intents = json.load(json_data)

# Load model to predict user result
loadedIntentClassifier = load_model('saved_state/intent_model.h5')
#loadedIntentClassifier = load_model('saved_state/intent_model.tflite')
loaded_intent_CV = pk.load(open('saved_state/IntentCountVectorizer.sav', 'rb'))

@app.route("/")
def home():
    return render_template("upload.html")

@app.route("/get")
def get_bot_response():
    USER_INTENT = ""
    while True:
        try:
            user_query = request.args.get('msg')
            query = re.sub('[^a-zA-Z]', ' ', user_query)
            # Tokenize sentence
            query = query.split(' ')
            # Lemmatizing
            ps = PorterStemmer()
            tokenized_query = [ps.stem(word.lower()) for word in query]
            # Recreate the sentence from tokens
            processed_text = ' '.join(tokenized_query)
            # Transform the query using the CountVectorizer
            processed_text = loaded_intent_CV.transform([processed_text]).toarray()
            # Make the prediction
            predicted_Intent = loadedIntentClassifier.predict(processed_text)
            # print(predicted_Intent)
            result = np.argmax(predicted_Intent, axis=1)
            # print(result)
            for key, value in intent_label_map.items():
                if value == result[0]:
                    # print(key)
                    USER_INTENT = key
                    break
            for i in intents['intents']:
                if i['tag'] == USER_INTENT:
                    responce = random.choice(i['responses'])
                    print("AgroBot: ", responce)
            return str(responce)

        except:
            pass

if __name__ == "__main__":
    app.run()