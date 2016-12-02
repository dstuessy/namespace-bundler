module.exports = (function() {
    let proto = Object.create(null);

    // clone any given object
    // clone :: a -> a
    function cloneObject (obj) {
        let proto = Object.getPrototypeOf(obj);
        let clone = Object.create(proto);
        let isArray = Array.isArray(obj);

        return Object.keys(obj).reduce((clone, key) => {
            let val = obj[key];
            
            if (isArray)
                clone.push(val);
            else
                clone[key] = val;
            
            return clone;
        }, clone);
    }

    function graph(options = {}) {
        let {
            value = null, 
            children = []
        } = options;
        let graphObj = Object.create(proto);

        graphObj.value = value;
        graphObj.children = children;

        return graphObj;
    }

    return graph;
}());