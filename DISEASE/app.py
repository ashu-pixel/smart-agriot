
import io
import string
from flask import Flask, jsonify, request, render_template

import numpy as np
import pickle
from cv2 import cv2
import os
# import matplotlib.pyplot as plt
from os import listdir
#from keras.models import Sequential
from tensorflow.keras.utils import img_to_array


filename = 'plant_disease_classification_model_Version3.pkl'
model = pickle.load(open(filename, 'rb'))


# Load labels
filename = 'plant_disease_label_transform.pkl'
image_labels = pickle.load(open(filename, 'rb'))


app = Flask(__name__)


diseases = {
	"Apple___Apple_scab": "Apple scab is caused by a fungus, Venturia inaequalis, and is a serious disease of apple and crabapple (genus Malus) trees that spreads quickly and easily. Generally, you’ll first notice it in early spring, when rains, wind, and cool temperatures spread the fungal spores.",
	"Apple___Black_rot": "The fungus Botryosphaeria obtusa can cause devastating losses to apples and crabapples over a wide geographical range and especially in warm humid climates.",
	"Apple___Cedar_apple_rust": "Rusts are fungi that will not kill their hosts, although they sure make them suffer. There is even a term for pathogens that require living hosts: biotrophs (in contrast to necrotrophs, pathogens that kill their host and live off the dead tissue).",
	"Apple___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Blueberry___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Cherry_(including_sour)___Powdery_mildew":"Powdery mildew of sweet and sour cherry is caused by Podosphaera clandestina, an obligate biotrophic fungus. Mid- and late-season sweet cherry (Prunus avium) cultivars are commonly affected, rendering them unmarketable due to the covering of white fungal growth on the cherry surface (Fig. 1). Season long disease control of both leaves and fruit is critical to minimize overall disease pressure in the orchard and consequently to protect developing fruit from accumulating spores on their surfaces.",
	"Cherry_(including_sour)___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot":"Gray leaf spot (GLS) is a common fungal disease in the United States caused by the pathogen Cercospora zeae-maydis in corn.Disease development is favored by warm temperatures, 80°F or 27 °C; and high humidity, relative humidity of 90% or higher for 12 hours or more.",
	"Corn_(maize)___Common_rust_":"Common rust of sweet corn is caused by the fungus Puccinia sorghi and can result in serious losses in yield or quality of sweet corn. Sweet corn rust occurs in temperate to sub-tropical regions and overwinters in the southern Unites States and Mexico. Summer storms and winds blow the spores of corn rust fungus into the Corn Belt.",
	"Corn_(maize)___Northern_Leaf_Blight":"Northern leaf blight in corn is a bigger problem for large farms than for home gardeners, but if you grow corn in your Midwestern garden, you may see this fungal infection. The fungus that causes the disease overwinters in debris and proliferates during moderate temperatures and wet conditions. You can manage and prevent the fungal infection or use a fungicide.",
	"Corn_(maize)___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Grape___Black_rot":"Black rot is one of the most serious diseases of grapes in the eastern United States. Crop losses can range from 5 to 80 percent, depending on the amount of disease in the vineyard, the weather, and variety susceptibility. The fungus Guignardia bidwelli can infect all green parts of the vine. Most damaging is the effect on fruit. Later fruit infections can destroy many grapes, even the entire crop.",
	"Grape___Esca_(Black_Measles)":"Grapevine measles, also called esca, black measles or Spanish measles, has long plagued grape growers with its cryptic expression of symptoms and, for a long time, a lack of identifiable causal organism(s).",
	"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)":"If the disease on the berries is not controlled in the field, it can lead to berry rotting during transit and storage. Bordeaux mixture (1.0%), Mancozeb (0.2%), Topsin-M (0.1%), Ziram (0.35%) or Captan (0.2%) is to be sprayed alternatively at weekly intervals from Jun-August and again from December until harvest to keep this disease under check. Two to three sprays of systemic fungicides should be given per season.",
	"Grape___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Orange___Haunglongbing_(Citrus_greening)":"Florida Citrus growers, the state of Florida and the U.S. Department of Agriculture have dedicated the last decade to researching citrus greening to help limit the spread of the disease and its impact on trees",
	"Peach___Bacterial_spot":"Bacterial canker is an infection that causes split bark and weeping cankers on the stems, branches, and trunks of affected peach trees. Bacterial canker is a serious condition that can kill your peach tree, especially if lesions appear low on the trunk and cause girdling.",
	"Peach___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Pepper__bell___Bacterial_spot":"Bacterial leaf spot, caused by Xanthomonas campestris pv. vesicatoria, is the most common and destructive disease for peppers in the eastern United States. It is a gram-negative, rod-shaped bacterium that can survive in seeds and plant debris from one season to another ",
	"Pepper__bell___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Potato___Early_blight":"Early blight is primarily a disease of stressed or senescing plants. Symptoms appear first on the oldest foliage. Affected leaves develop circular to angular dark brown lesions 0.12 to 0.16 inch (3–4 mm) in diameter. Concentric rings often form in lesions to produce characteristic target-board effect. Severely infected leaves turn yellow and drop. Infected tubers show a brown, corky dry rot.",
	"Potato___Late_blight":"Late blight lesions can occur on all aboveground plant parts. On leaves, lesions typically first appear as small pale to dark green water-soaked spots that are irregular in shape and surrounded by a zone of yellowish tissue. Under conducive conditions, lesions expand rapidly and become brown to purplish black as tissue is killed. Under sufficient humidity, white sporulation of the fungus can be observed at the periphery of lesions, principally on the underside of leaves.",
	"Potato___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Raspberry___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Soybean___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Squash___Powdery_mildew":"Powdery mildew is a fungal disease caused by a few closely related fungi. Each fungi targets a specific host plant for survival. The fungi produces a white, thread-like structure called ‘mycelium’ that grows on the surface of the host plant. This micro web structure is grayish white in color and looks similar to dusting of telcum powder. The fungus’s root-like tentacles penetrates the top later of the plant surface to suck the nutrients, but they do not damage the plant’s tissues.",
	"Strawberry___Leaf_scorch":"Leaf Scorch is the most common leaf disease in matted row systems in North Carolina but rarely occurs in annual production systems. The pathogen can survive and cause disease at a wide range of temperatures, and has been reported to cause disease year-round on perennial crops. Replanting frequently is recommended in these systems since the disease usually is not severe the first or second year after planting. Because of this, leaf scorch is not a major problem in annual systems.",
	"Strawberry___healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work",
	"Tomato_Bacterial_spot":"Bacterial spot of tomato is a potentially devastating disease that, in severe cases, can lead to unmarketable fruit and even plant death.  Bacterial spot can occur wherever tomatoes are grown, but is found most frequently in warm, wet climates, as well as in greenhouses.  The disease is often an issue in Wisconsin.",
	"Tomato_Early_blight":"Common on tomato and potato plants, early blight is caused by the fungus Alternaria solani and occurs throughout the United States. Symptoms first appear on the lower, older leaves as small brown spots with concentric rings that form a “bull’s eye” pattern. As the disease matures, it spreads outward on the leaf surface causing it to turn yellow, wither and die.",
	"Tomato_Late_blight":"Leaf symptoms of late blight first appear as small, water-soaked areas that rapidly enlarge to form purple-brown, oily-appearing blotches. On the lower side of leaves, rings of grayish white mycelium and spore-forming structures may appear around the blotches. Entire leaves die and infections quickly spread to petioles and young stems. Infected fruit turn brown but remain firm unless infected by secondary decay organisms; symptoms usually begin on the shoulders of the fruit because spores land on fruit from above.",
	"Tomato_Leaf_Mold":"",
	"Tomato_Septoria_leaf_spot":"Septoria leaf spot is a very common disease of tomatoes.1﻿ It is caused by a fungus (Septoria lycopersici) and can affect tomatoes and other plants in the Solanaceae family, especially potatoes and eggplant, just about anywhere in the world. Although Septoria leaf spot is not necessarily fatal for your tomato plants, it spreads rapidly and can quickly defoliate and weaken the plants, rendering them unable to bear fruit to maturity. ",
	"Tomato_Spider_mites_Two_spotted_spider_mite":"As the summer heat continues, it is common to see spider mites on commercial and home-grown tomatoes. Heat, drought, water stress, the presence of a large number of weeds, and incorrect use of insecticides can lead to high buildup of mites on tomatoes.",
	"Tomato__Target_Spot":"Also known as early blight, target spot of tomato is a fungal disease that attacks a diverse assortment of plants, including papaya, peppers, snap beans, potatoes, cantaloupe, and squash as well as passion flower and certain ornamentals. Target spot on tomato fruit is difficult to control because the spores, which survive on plant refuse in the soil, are carried over from season to season. Read on to learn how to treat target spot on tomatoes.",
	"Tomato__Tomato_YellowLeaf__Curl_Virus":"Tomato yellow leaf curl virus (TYLCV), a disease that threatens both commercial tomato production fields and home gardens, was identified in March 2007 by Dr. Robert Gilbertson, University of California, Davis (UCD), in greenhouse tomato samples from Brawley, Calif.",
	"Tomato__Tomato_mosaic_virus":"The mosaic virus is a parasite that destroys plants, gardens, and crops down to their molecular level. Once a plant contracts the mosaic virus, the infected plant can then spread the virus to other plants and even affect an entire harvest if left untreated.",
	"Tomato_healthy":"DON'T WORRY MATE!Your plant is healthy.Keep up the good work"
}

disease_link={
	"Apple___Apple_scab": "https://www.independenttree.com/apple-scab-identification-prevention-treatment-2/#:~:text=Remember%3A%20Apple%20scab%20is%20treated,spray%20is%20all%20you%20need",
	"Apple___Black_rot": "https://gardenerspath.com/how-to/disease-and-pests/apple-black-rot-frogeye-leaf-spot/",
	"Apple___Cedar_apple_rust": "https://gardenerspath.com/how-to/disease-and-pests/cedar-apple-rust-control/",
	"Apple___healthy":"",
	"Blueberry___healthy":"",
	"Cherry_(including_sour)___Powdery_mildew":"http://treefruit.wsu.edu/crop-protection/disease-management/cherry-powdery-mildew/",
	"Cherry_(including_sour)___healthy":"",
	"Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot":"https://www.pioneer.com/us/agronomy/gray_leaf_spot_cropfocus.html",
	"Corn_(maize)___Common_rust_":"https://www.gardeningknowhow.com/edible/vegetables/corn/corn-rust-fungus-control.htm#:~:text=To%20reduce%20the%20incidence%20of,immediately%20spray%20with%20a%20fungicide",
	"Corn_(maize)___Northern_Leaf_Blight":"https://www.gardeningknowhow.com/edible/vegetables/corn/northern-corn-leaf-blight-control.htm#:~:text=Treating%20northern%20corn%20leaf%20blight%20involves%20using%20fungicides.,the%20fungicide%20should%20be%20applied",
	"Corn_(maize)___healthy":"",
	"Grape___Black_rot":"https://extension.psu.edu/black-rot-on-grapes-in-home-gardens",
	"Grape___Esca_(Black_Measles)":"https://grapes.extension.org/grapevine-measles/",
	"Grape___Leaf_blight_(Isariopsis_Leaf_Spot)":"",
	"Grape___healthy":"",
	"Orange___Haunglongbing_(Citrus_greening)":"https://www.floridacitrus.org/newsroom/citrus-411/citrus-greening/potential-citrus-greening-solutions/",
	"Peach___Bacterial_spot":"https://www.lawnstarter.com/blog/tree-care/peach-tree-diseases-how-to-treat-them/",
	"Peach___healthy":"",
	"Pepper__bell___Bacterial_spot":"https://extension.wvu.edu/lawn-gardening-pests/plant-disease/fruit-vegetable-diseases/bacterial-leaf-spot-of-pepper#:~:text=Seed%20treatment%20with%20hot%20water,relatively%20low%20with%20bleach%20treatment",
	"Pepper__bell___healthy":"",
	"Potato___Early_blight":"https://www2.ipm.ucanr.edu/agriculture/potato/Early-Blight/",
	"Potato___Late_blight":"https://www2.ipm.ucanr.edu/agriculture/potato/late-blight/#:~:text=Late%20blight%20is%20controlled%20by,foliage%20each%20day%20is%20important",
	"Potato___healthy":"",
	"Raspberry___healthy":"",
	"Soybean___healthy":"",
	"Squash___Powdery_mildew":"https://pinchofseeds.com/powdery-mildew-on-plants/#:~:text=A%20better%20treatment%20solution%20for,oil%20and%20some%20dish%20soap",
	"Strawberry___Leaf_scorch":"https://content.ces.ncsu.edu/leaf-scorch-of-strawberry",
	"Strawberry___healthy":"",
	"Tomato_Bacterial_spot":"https://hort.extension.wisc.edu/articles/bacterial-spot-of-tomato/#:~:text=A%20plant%20with%20bacterial%20spot,DO%20NOT%20eat%20symptomatic%20fruit",
	"Tomato_Early_blight":"https://www.planetnatural.com/pest-problem-solver/plant-disease/early-blight/",
	"Tomato_Late_blight":"https://www2.ipm.ucanr.edu/agriculture/tomato/Late-Blight/",
	"Tomato_Leaf_Mold":"https://plantix.net/en/library/plant-diseases/100257/leaf-mold-of-tomato",
	"Tomato_Septoria_leaf_spot":"https://www.thespruce.com/identifying-and-controlling-septoria-leaf-spot-of-tomato-1402974",
	"Tomato_Spider_mites_Two_spotted_spider_mite":"https://www.growingproduce.com/crop-protection/insect-control/managing-mites-on-tomato-crops/",
	"Tomato__Target_Spot":"https://www.gardeningknowhow.com/edible/vegetables/tomato/target-spot-on-tomatoes.htm#:~:text=The%20following%20tips%20for%20treating,thus%20beginning%20the%20disease%20anew",
	"Tomato__Tomato_YellowLeaf__Curl_Virus":"https://www.farmprogress.com/controlling-tomato-yellow-leaf-curl-virus",
	"Tomato__Tomato_mosaic_virus":"https://www.planetnatural.com/pest-problem-solver/plant-disease/mosaic-virus/",
	"Tomato_healthy":""
}


@app.route('/', methods=['GET', 'POST'])


def upload_file():
	if request.method == 'POST':
		img=request.files.get('file')

		img_path="static/" + img.filename
		img.save(img_path)
		
		DEFAULT_IMAGE_SIZE = tuple((64, 64))

		def convert_image_to_array(image_dir):
			try:
				image = cv2.imread(image_dir)
				if image is not None:
					image = cv2.resize(image, DEFAULT_IMAGE_SIZE)   
					return img_to_array(image)
				else:
					return np.array([])
			except Exception as e:
				print(f"Error : {e}")
				return None

		def predict_disease(img_path):
			image_array = convert_image_to_array(img_path)
			np_image = np.array(image_array, dtype=np.float16) / 225.0
			np_image = np.expand_dims(np_image,0)
			#plt.imshow(plt.imread(img_path))
			predict_x=model.predict(np_image) 
			classes_x=np.argmax(predict_x,axis=1)
			#print((image_labels.classes_[classes_x][0]))
			ans=image_labels.classes_[classes_x][0]
			return ans

		return render_template('result.html', value=img_path, prediction=predict_disease(img_path),description=diseases[predict_disease(img_path)] ,decp=disease_link[predict_disease(img_path)])
	else:
		return render_template('index.html')

# Dimension of resized image

	

if __name__=="__main__":
    app.run(debug=True)