import numpy as np
import pickle
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load model from model.pkl
Wmodel = pickle.load(open('./models/weather_prediction.pkl', 'rb'))
Cmodel = pickle.load(open('./models/crop_prediction.pkl', 'rb'))

@app.route('/' , methods=['GET'])
def hm():
    return jsonify({"ans": "HELLO WORLD from SMART-AgrIoT"})

@app.route('/CropPred', methods=['POST'])
def pres():
     
    content_type = request.headers.get('Content-Type')
    
    if (content_type == 'application/json'):
        incomingData = request.json

        cr = incomingData["marketVals"]
        data = incomingData["formVals"]
        

        final_features = [np.array(data)]

        pred_proba = Cmodel.predict_proba(final_features)

        res = {}
        crops = {'apple': 0, 'banana': 1, 'blackgram': 2, 'chickpea': 3, 'coconut': 4, 'coffee': 5,
                 'cotton': 6, 'grapes': 7, 'jute': 8, 'kidneybeans': 9, 'lentil': 10, 'maize': 11,
                 'mango': 12, 'mothbeans': 13, 'mungbean': 14, 'muskmelon': 15, 'orange': 16, 'papaya': 17,
                 'pigeonpeas': 18, 'pomegranate': 19, 'rice': 20, 'watermelon': 21}

        keys = list(crops.keys())
        values = list(crops.values())

        for i in range(len(pred_proba[0])):
            if(pred_proba[0][i] > 0):
                res[i] = pred_proba[0][i]

        keys1 = list(res.keys())
        values1 = list(res.values())

        sorted_value_index = np.argsort(values1)
        sorted_dict = {keys1[i]: values1[i] for i in sorted_value_index}
        sorted_dict = {keys[values.index(keys1[i])]: values1[i]
                       for i in sorted_value_index}

        final_op = {}
        for key in sorted_dict:
            if key in cr:
                final_op[key] = sorted_dict[key] * cr[key]

        top_classes = []
        for x in list(reversed(list(final_op))):
            top_classes.append(x)

        # response = jsonify({
        #     "statusCode": 200,
        #     "status": "Prediction made",
        #     "result": top_classes[0]
        # })

        return jsonify({"res1": top_classes[0], "res2": top_classes[1], "res3": top_classes[2] })

    else:
        return 'bad request!', 400


@app.route('/weatherPred', methods=['POST' ])
def predict():
     
    content_type = request.headers.get('Content-Type')
     
    if (content_type == 'application/json'):

        data = request.json
        final_features = [np.array(data["formVals"])]
         
        prediction = Wmodel.predict(final_features)
        output = prediction[0]
        ans = {"val": output}

        return jsonify(ans)
    else:
        return 'bad request!', 400

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))