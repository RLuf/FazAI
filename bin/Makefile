# Makefile para compilação do FazAI CLI em C (fazai_c)
# Autor: Versão de teste em C

CC = gcc
CFLAGS = -Wall -O2
LIBS = -lcurl

TARGET = fazai_c
SRC = fazai_c.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC) $(LIBS)

clean:
	rm -f $(TARGET)
