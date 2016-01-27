build:
	uglifyjs yookey.js -o jockey.min.js --reserved "Yookey,window" \
		--source-map yookey.min.map -c -m sort

.PHONY: build
