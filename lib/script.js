/**
 * create hash string sha256
 */
var sha256 = function sha256(ascii) {
	function rightRotate(value, amount) {
		return (value>>>amount) | (value<<(32 - amount));
	};
	
	var mathPow = Math.pow;
	var maxWord = mathPow(2, 32);
	var lengthProperty = 'length'
	var i, j; // Used as a counter across the whole file
	var result = ''

	var words = [];
	var asciiBitLength = ascii[lengthProperty]*8;
	
	//* caching results is optional - remove/add slash from front of this line to toggle
	// Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
	// (we actually calculate the first 64, but extra values are just ignored)
	var hash = sha256.h = sha256.h || [];
	// Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
	var k = sha256.k = sha256.k || [];
	var primeCounter = k[lengthProperty];
	/*/
	var hash = [], k = [];
	var primeCounter = 0;
	//*/

	var isComposite = {};
	for (var candidate = 2; primeCounter < 64; candidate++) {
		if (!isComposite[candidate]) {
			for (i = 0; i < 313; i += candidate) {
				isComposite[i] = candidate;
			}
			hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
			k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
		}
	}
	
	ascii += '\x80' // Append Ƈ' bit (plus zero padding)
	while (ascii[lengthProperty]%64 - 56) ascii += '\x00' // More zero padding
	for (i = 0; i < ascii[lengthProperty]; i++) {
		j = ascii.charCodeAt(i);
		if (j>>8) return; // ASCII check: only accept characters in range 0-255
		words[i>>2] |= j << ((3 - i)%4)*8;
	}
	words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
	words[words[lengthProperty]] = (asciiBitLength)
	
	// process each chunk
	for (j = 0; j < words[lengthProperty];) {
		var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
		var oldHash = hash;
		// This is now the undefinedworking hash", often labelled as variables a...g
		// (we have to truncate as well, otherwise extra entries at the end accumulate
		hash = hash.slice(0, 8);
		
		for (i = 0; i < 64; i++) {
			var i2 = i + j;
			// Expand the message into 64 words
			// Used below if 
			var w15 = w[i - 15], w2 = w[i - 2];

			// Iterate
			var a = hash[0], e = hash[4];
			var temp1 = hash[7]
				+ (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
				+ ((e&hash[5])^((~e)&hash[6])) // ch
				+ k[i]
				// Expand the message schedule if needed
				+ (w[i] = (i < 16) ? w[i] : (
						w[i - 16]
						+ (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3)) // s0
						+ w[i - 7]
						+ (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10)) // s1
					)|0
				);
			// This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
			var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
				+ ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2])); // maj
			
			hash = [(temp1 + temp2)|0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
			hash[4] = (hash[4] + temp1)|0;
		}
		
		for (i = 0; i < 8; i++) {
			hash[i] = (hash[i] + oldHash[i])|0;
		}
	}
	
	for (i = 0; i < 8; i++) {
		for (j = 3; j + 1; j--) {
			var b = (hash[i]>>(j*8))&255;
			result += ((b < 16) ? 0 : '') + b.toString(16);
		}
	}
	return result;
}

/**
 * transfer money from sender to receiver
 */
async function transferMoney(senderclass, receiverclass, senderBalanceId, receiverBalanceId, amount) {
  //get person assetregistry
  const senderBalanceAssetRegistry = await getAssetRegistry("org.example.cod." + senderclass);
  const receiverBalanceAssetRegistry = await getAssetRegistry("org.example.cod." + receiverclass);
  
  //get person balance
  let senderBalance = await senderBalanceAssetRegistry.get(senderBalanceId);
  let receiverBalance = await receiverBalanceAssetRegistry.get(receiverBalanceId);
  if (senderBalance.amount < amount){
    return false;
  }
  else {
    //update amount data
    senderBalance.amount = senderBalance.amount - amount;
    receiverBalance.amount = receiverBalance.amount + amount;
    
    //store update
    await senderBalanceAssetRegistry.update(senderBalance);
    await receiverBalanceAssetRegistry.update(receiverBalance);
    return true;
  }
}

/**
 * create assetHash
 */
async function createAssetHash(assetId, buyer, orderId) {
  //define data type
  var assetRegistry = await getAssetRegistry("org.example.cod.Assets");
  var assetHashRegistry = await getAssetRegistry("org.example.cod.AssetHash");
  
  //get data
  var assetData = await assetRegistry.get(assetId);
  var assetHash = assetData.seller.getIdentifier() + orderId + assetId + assetData.name;
  //create asset hash
  for (let i = 0; i < assetData.detail.length; i++){
    assetHash += assetData.detail[i];
  }
  
  //create new asset hash
  var factory = getFactory();
  var newAssetHash = factory.newResource("org.example.cod","AssetHash",assetId);
  newAssetHash.orderId = orderId;
  newAssetHash.hash = sha256(assetHash + assetData.quantity + assetData.price);
  newAssetHash.buyerId = buyer;
  assetHashRegistry.add(newAssetHash);
  //return true;
}

/**
 * create order, assetHash and package
 * @param {org.example.cod.trsCreateOrder} order - date will be use to create order
 * @transaction
 */
async function createOrder(order){
  var orderRegistry = await getAssetRegistry("org.example.cod.Order");
  var assetRegistry = await getAssetRegistry("org.example.cod.Assets");
  var assetData = "";
  //get data
  for (let i = 0; i < order.assets.length; i++){
    assetData = await assetRegistry.get(order.assets[i].assetId);
  }
   
  
  var factory = getFactory();
  var newOrder = factory.newResource("org.example.cod","Order",order.orderId);
  newOrder.orderId = order.orderId;
  newOrder.seller = assetData.seller;
  newOrder.assets = order.assets;
  newOrder.buyer = order.buyerId;
  orderRegistry.add(newOrder);
  //create assetHash
  for(let i = 0; i < order.assets.length; i++){
    createAssetHash(order.assets[i].assetId, order.buyerId.personId, order.orderId);
  }
}

/**
 * create package of order
 * @param {org.example.cod.trsCreatePackage} order - order to be packaged
 * @transaction
 */

async function createPackage(order){
  //define data type
  var packageRegistry = await getAssetRegistry("org.example.cod.Package");
  var orderRegistry = await getAssetRegistry("org.example.cod.Order");
  
  //get order data
  var orderData = await orderRegistry.get(order.order.orderId);
  
  //define variable
  var orderId = order.order.orderId;
  var sellerId = order.order.seller.personId;
  var deliveryId = order.order.buyer.personId;
  //create new package
  var factory = getFactory();
  var newPackage = factory.newResource("org.example.cod","Package",orderId);
  newPackage.seller = order.order.seller;
  newPackage.delivery = order.delivery;
  newPackage.shipper = "";
  newPackage.buyer = order.order.buyer;
  packageRegistry.add(newPackage);
}

/**
 * transfer money from delivery to mortgage account
 * @param {org.example.cod.trsDeposit} balance - balance to be updated
 * @transaction
 */
async function trstransferMoney(balance){
  var deliveryBalanceID = balance.delivery.balanceId;
  var mortgageBalanceID = balance.mortgage.balanceId;
  var amountTransfer = balance.amountTransfer;
  
  transferMoney("DeliveryBalance", "MortgageBalance", deliveryBalanceID, mortgageBalanceID, amountTransfer);
  
  if (transferMoney("DeliveryBalance", "MortgageBalance", deliveryBalanceID, mortgageBalanceID, amountTransfer) == false){
    alert("delivery's balance doesn't enought");
  }
  else {
    alert("tranfer money successful");
  } 
}


/**
 * verify when the first shipper meet seller
 * @param {org.example.cod.trsVerifyShipper} order - the order will be verify
 * @transaction
 */
async function verifyShipper(order){
  //create data type
  const packageRegister = await getAssetRegistry("org.example.cod.Package");
  const assetHashRegistry = await getAssetRegistry("org.example.cod.AssetHash");
  const timeLimitRegister = await getAssetRegistry("org.example.cod.LimitTime");
  const historyVerifyRegistry = await getAssetRegistry("org.example.cod.HistoryRecordVerifyShipper");
  
  //get data of package, assetHash and limitTime
  var packageData = await packageRegister.get(order.package.orderId);
  var assetHash = await assetHashRegistry.get(order.assetId);
  var limitTime = await timeLimitRegister.get(order.package.orderId);
  var ISOdealTime = limitTime.dealTime.toISOString();
  
  //create present DateTime
  var date = new Date().toISOString();
  
  //verify
  if (("CANCELED" == packageData.state) || ("SHIPPED" == packageData.state)){
    return alert(packageData.state + " cannot update order state " + ISOdealTime);
  }
  else if((date < ISOdealTime) && (assetHash.hash == order.hash)){
    //change package state to "TRANSPORTING" and update to database
    packageData.shipper = order.shipper.getIdentifier();
    packageData.state = "TRANSPORTING";
    packageRegister.update(packageData);
    
    //create new verify data
    let factory = getFactory();
    let newHistoryVerify = factory.newResource("org.example.cod", "HistoryRecordVerifyShipper", order.historyRecordId);
    newHistoryVerify.orderId = order.package.orderId;
    newHistoryVerify.assetId = order.assetId;
    newHistoryVerify.hash = order.hash;
    newHistoryVerify.shipper = order.shipper;
    newHistoryVerify.time = order.time;
    newHistoryVerify.state = "SUCCESSFUL";
    historyVerifyRegistry.add(newHistoryVerify);
    return alert(assetHash.hash + " order has been verify successful");
  }
  else if ((date < ISOdealTime) && (assetHash.hash != order.hash)){
    //change package state to "CANCELED" and update to database
    packageData.shipper = order.shipper.getIdentifier();
    packageData.state = "CANCELED";
    packageRegister.update(packageData);
    
    //create new verify data
    let factory = getFactory();
    let newHistoryVerify = factory.newResource("org.example.cod", "HistoryRecordVerifyShipper", order.historyRecordId);
    newHistoryVerify.orderId = order.package.orderId
    newHistoryVerify.assetId = order.assetId;
    newHistoryVerify.hash = order.hash;
    newHistoryVerify.shipper = order.shipper;
    newHistoryVerify.time = order.time;
    newHistoryVerify.state = "FAILED";
    historyVerifyRegistry.add(newHistoryVerify);
    return alert("wrong asset hash, order has been canceled");
  }
  else{
    return alert("cannot verify package, information is invalid");
  }
}

/**
 * verify order to buyer
 * @param {org.example.cod.trsEncryptAsset} asset - asset to be verify
 * @transaction
 */
async function verifyAsset(asset){
  var assetDetail = "";
  for (let i = 0; i < asset.detail.length; i++){
    assetDetail += asset.detail[i];
  }
  var hash = sha256(asset.sellerId + asset.orderId + asset.assetId + asset.assetName + 
                    assetDetail + asset.quantity + asset.price);
  alert(hash);
}


/**
 * verify payment for order
 * @param {org.example.cod.trsVerifyPayment} order - order to be verify
 * @transaction
 */
async function veriryPayment(order){
  //define variable
  var packageId = order.orderId.orderId;
  var packageRegistry = await getAssetRegistry("org.example.cod.Package");
  var limitTimeRegistry = await getAssetRegistry("org.example.cod.LimitTime");
  
  var packageData = await packageRegistry.get(packageId);
  var limitTime = await limitTimeRegistry.get(packageId);
  
  //create present date
  var presentDate = new Date().toISOString();
  var dealTime = limitTime.dealTime.toISOString();
  
  if((presentDate <= dealTime) && (packageData.state == "TRANSPORTING")){
  	//change value to shipped
  	packageData.state = "SHIPPED";
    return packageRegistry.update(packageData);
  }
  else {
  	//update oder state
    alert("cannot make payment for this order");
  }
  
  //alert(dealTime);
}

/**
 * automatically transfer money from mortgage account to seller balance
 * @param {org.example.cod.trsGetBackMoney} time - balance to be get
 * @transaction
 */
async function getBackMoney(time){
  //get userId
  let mortgageId = time.time.mortgage.balanceId;
  
  //get user identity
  var currentUser = await getCurrentParticipant();
  var userClass = await currentUser.getFullyQualifiedType();
  var userIdentity = await currentUser.getIdentifier();
  var identityBalance = "";
  
  if("org.example.cod.Seller" == userClass){
    identityBalance = "SellerBalance";
  }
  else if("org.example.cod.DeliveryCompany" == userClass){
    identityBalance = "DeliveryBalance";
  }
  else {
    return alert("user " + userClass + " don't have permission to get money");
  }
  
  //get balance registry
  var balanceData = await getAssetRegistry("org.example.cod." + identityBalance);
  var mortgageRegistry = await getAssetRegistry("org.example.cod.MortgageBalance");
  var packageRegistry = await getAssetRegistry("org.example.cod.Package");
  
  //get balance data
  var userBalance = await balanceData.get(userIdentity);
  var mortgageBalance = await mortgageRegistry.get(mortgageId);
  
  //get order's data
  var package = await packageRegistry.get(time.time.orderId);
  var date = new Date().toISOString();
  
  //processor
  if(userClass == "org.example.cod.Seller"){
    if((package.state == "CANCELED") || ((package.state == "TRANSPORTING") && (date > time.time.dealTime.toISOString()))){
      //senderclass, receiverclass, senderBalanceId, receiverBalanceId, amount
      transferMoney("MortgageBalance", "SellerBalance", mortgageId, userIdentity, mortgageBalance.amount);
      return alert("transfer successful");
    }
    else{
      return alert("seller cannot getback money");
    }
  }
  else if(userClass == "org.example.cod.DeliveryCompany"){
    if((package.state == "SHIPPED") && (date <= time.time.dealTime.toISOString())){
      //senderclass, receiverclass, senderBalanceId, receiverBalanceId, amount
      transferMoney("MortgageBalance", "DeliveryBalance", mortgageId, userIdentity, mortgageBalance.amount);
    }
    else{
    	return alert("Delivery don't have permission to getback money");
    }
  }
  else {
    return alert("user doesn't have permission to execute transaction");
  }
  
}

//=====================================================================================================
/**
 * QUERY
 */
//=====================================================================================================
/**
 * query asset by id
 * @param {org.example.cod.getAsset} asset - asset to be get
 * @transaction
 */
async function getAssetById(asset){
  let assetRegistry = await getAssetRegistry("org.example.cod.Assets")
  let assetId = asset.id;
  const result = await query("selectAsset",{id: assetId})
  
  for (let i = 0; i < result.length; i++){
    alert(
      "assetId: " + result[i].assetId +
      "\nassetName: " + result[i].name +
      "\ndetail: " + result[i].detail +
      "\nquantity: " + result[i].quantity +
      "\nprice: " + result[i].price
         );
  }
}