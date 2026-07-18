import time
import random
import string
from itertools import combinations
import networkx as nx

def generate_random_entities(n):
    return [''.join(random.choices(string.ascii_letters, k=5)) for _ in range(n)]

def benchmark_current(iterations=5):
    entities_list = [generate_random_entities(500) for _ in range(iterations)]
    total_time = 0
    for entities in entities_list:
        graph = nx.Graph()
        start = time.time()
        for i in range(len(entities)):
            for j in range(i + 1, len(entities)):
                u, v = entities[i], entities[j]
                if graph.has_edge(u, v):
                    current_w = graph[u][v].get('weight', 0.5)
                    graph[u][v]['weight'] = min(1.0, current_w + 0.05)
                else:
                    graph.add_edge(u, v, weight=0.5)
        end = time.time()
        total_time += (end - start)
    return total_time / iterations

def benchmark_optimized(iterations=5):
    entities_list = [generate_random_entities(500) for _ in range(iterations)]
    total_time = 0
    for entities in entities_list:
        graph = nx.Graph()
        start = time.time()
        for u, v in combinations(entities, 2):
            if graph.has_edge(u, v):
                current_w = graph[u][v].get('weight', 0.5)
                graph[u][v]['weight'] = min(1.0, current_w + 0.05)
            else:
                graph.add_edge(u, v, weight=0.5)
        end = time.time()
        total_time += (end - start)
    return total_time / iterations

if __name__ == "__main__":
    t1 = benchmark_current()
    print(f"Current implementation avg: {t1:.4f} seconds")
    t2 = benchmark_optimized()
    print(f"Optimized implementation avg: {t2:.4f} seconds")
    if t1 > 0:
        print(f"Improvement: {(t1 - t2) / t1 * 100:.2f}%")
