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

    // Tree.prototype.insert :: (Tree(a) -> Tree(a) -> Tree(a) | Null) -> a -> Tree(a)
    proto.insert = function(predicate, a) {
        let clone = cloneObject(this);
        let children = cloneObject(this.children);
        let { insertNode, treeNode } = predicate(a, clone);

        if (insertNode) {
            treeNode.children = children.map(t => {
                return t.insert(predicate, insertNode);
            });
            treeNode.children = treeNode.children.concat([insertNode]);
            return treeNode;
        } else {
            return clone;
        }
    };

    function tree(options = {}) {
        let {
            value = null, 
            children = []
        } = options;
        let treeObj = Object.create(proto);

        treeObj.value = value;
        treeObj.children = children;

        return treeObj;
    }

    return tree;
}());