module.exports = (function () {
    let proto = Object.create(null);

    function cloneObj(obj) {
        let proto = Object.getPrototypeOf(obj);
        let clone = Object.create(proto);

        return Object.keys(obj).reduce((clone, key) => {
            let val = obj[key];
            clone[key] = val;

            return clone;
        }, clone);
    }

    function reduceObj(fn, start, obj) {
        return Object.keys(obj).reduce((acc, key) => fn(acc, obj[key], key), start);
    }

    function filterObj(predicate, obj) {
        return Object.keys(obj).filter(key => predicate(obj[key], key));
    }

    function setObj(value, key, obj) {
        let clone = cloneObj(obj);
        clone[key] = value;
        return clone;
    }

    function mergeObj(objA, objB) {
        return reduceObj((objB, val, key) => setObj(val, key, objB), cloneObj(objB), objA);
    }

    proto.merge = function (graph) {
        let verteces = mergeObj(graph.verteces, this.verteces);
        let edges = mergeObj(graph.edges, this.edges);

        return Graph(verteces, edges);
    };

    proto.insert = function (key, value, edges) {
        let verteces = { key: value };

        return this.merge(Graph(verteces, edges));
    };

    proto.insertVerteces = function (verteces) {
        return this.merge(Graph(verteces, {}));
    };

    proto.insertEdges = function (edges) {
        return this.merge(Graph({}, edges));
    };

    proto.insertVertex = function (key, value) {
        let verteces = {};

        verteces[key] = value;

        return this.insertVerteces(verteces);
    };

    proto.insertEdge = function (source, destination, value = {}) {
        let edges = {};
        let edgeKey = `${source}->${destination}`;

        edges[edgeKey] = value;

        return this.insertEdges(edges);
    };

    proto.remove = function (deleteKey) {
        let verteces = reduceObj((verteces, vertex, key) => {
            if (key === deleteKey)
                return verteces;
            else
                return setObj(vertex, key, verteces);
        }, {}, this.verteces);
        let edges = filterObj((nothing, edgeString) => !edgeString.includes(deleteKey), this.edges);

        return Graph(verteces, edges);
    };

    proto.findVertex = function (predicate) {
        return reduceObj((foundVertex, vertex) => {
            if (predicate(vertex, foundVertex, this))
                return vertex;
            else
                return foundVertex;
        }, null, this.verteces);
    };

    proto.findEdges = function (predicate) {
        return reduceObj((foundEdges, value, key) => {
            let pair = key.split('->');
            let source = pair[0];
            let destination = pair[1];

            if (predicate(value, source, destination))
                foundEdges[key] = value;

            return foundEdges;
        }, {}, this.edges);
    };

    proto.isEmpty = function () {
        return Object.keys(this.verteces).length === 0 && Object.keys(this.edges) === 0;
    };

    function Graph(verteces = {}, edges = {}) {
        let graph = Object.create(proto);

        graph.verteces = verteces;
        graph.edges = edges;

        return graph;
    }

    return Graph;
} ());