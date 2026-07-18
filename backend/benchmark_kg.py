import time
import random
import string
from app.agents.kg import KnowledgeGraphManager

def generate_random_entities(n):
    return [''.join(random.choices(string.ascii_letters, k=5)) for _ in range(n)]

def benchmark_current():
    kg = KnowledgeGraphManager()
    entities = generate_random_entities(500)

    start = time.time()
    for i in range(len(entities)):
        for j in range(i + 1, len(entities)):
            u, v = entities[i], entities[j]
            if kg.graph.has_edge(u, v):
                current_w = kg.graph[u][v].get('weight', 0.5)
                kg.graph[u][v]['weight'] = min(1.0, current_w + 0.05)
            else:
                kg.graph.add_edge(u, v, weight=0.5)

    end = time.time()
    return end - start

from itertools import combinations

def benchmark_optimized():
    kg = KnowledgeGraphManager()
    entities = generate_random_entities(500)

    start = time.time()
    for u, v in combinations(entities, 2):
        if kg.graph.has_edge(u, v):
            current_w = kg.graph[u][v].get('weight', 0.5)
            kg.graph[u][v]['weight'] = min(1.0, current_w + 0.05)
        else:
            kg.graph.add_edge(u, v, weight=0.5)

    end = time.time()
    return end - start

if __name__ == "__main__":
    t1 = benchmark_current()
    print(f"Current implementation: {t1:.4f} seconds")
    t2 = benchmark_optimized()
    print(f"Optimized implementation: {t2:.4f} seconds")
    if t1 > 0:
        print(f"Improvement: {(t1 - t2) / t1 * 100:.2f}%")
